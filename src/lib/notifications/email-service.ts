/**
 * VIDNOV Email Service — the single entry point for all transactional mail.
 *
 * Every part of Vidnov (accounts, orders, AI studio, admin) sends through
 * `sendTemplateEmail` — never through a provider directly.
 *
 * Flow:  caller → template + vars → renderer → provider → emailLogs doc
 *
 * EMAIL_MODE=development (default) captures mail into the `devMailbox`
 * collection instead of sending — the Admin Communication Center renders it.
 * EMAIL_MODE=production + EMAIL_PROVIDER + EMAIL_API_KEY dispatch through the
 * configured provider and log the result to `emailLogs`.
 */

import { getVidnovConfig, appLink, mailboxFor, type EmailCategory } from './config';
import { pbWriteDevMailbox, pbWriteEmailLog } from '@/lib/pocketbase/email-logs';
import { getTemplate, type EmailTemplateDef } from './templates';
import { renderTemplate } from './renderer';
import { getEmailProvider, type OutgoingEmail } from './email-provider';
import {
  classifySendError,
  classifyThrown,
  hasDuplicateCooldown,
  nextAttemptIso,
  normalizeAddress,
  shouldRetry,
} from './email-reliability';
import { enqueueRetryJob, isSuppressed, updateRetryJob, type StoreDb } from './email-store';

export type EmailStatus =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'DELAYED'
  | 'FAILED'
  | 'BOUNCED'
  | 'SKIPPED';

export interface EmailLogEntry {
  id?: string;
  to: string;
  from: string;
  subject: string;
  template: string;
  category: EmailCategory;
  status: EmailStatus;
  provider: string;
  providerId?: string;
  userId?: string;
  sentAt?: unknown;
  deliveredAt?: unknown;
  failureReason?: string;
  /** Safe category (`rate_limited | timeout | server | config | invalid | …). */
  errorClass?: string;
  devMode: boolean;
  createdAt: unknown;
}

/**
 * Minimal Firestore contract — the real admin `db` satisfies it structurally
 * (collection/add/doc/where/limit and the document verbs), and tests may
 * pass a fake. Storage operations themselves live in `email-store.ts`.
 */
export type FirestoreLike = StoreDb;

// ---------------------------------------------------------------------------
// Lazy Firestore access — resolved through the shared, initialized admin app
// (src/firebase/server.ts) on first use; returns null in client bundles.
// ---------------------------------------------------------------------------
let firestoreRef: FirestoreLike | null | undefined;

function getDb(): FirestoreLike | null {
  if (firestoreRef !== undefined) return firestoreRef;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { db } = require('@/firebase/server') as { db: FirestoreLike };
    firestoreRef = db ?? null;
  } catch {
    firestoreRef = null;
  }
  return firestoreRef;
}

// ---------------------------------------------------------------------------
// Rate limiting — per-recipient token bucket (in-memory; per instance).
// ---------------------------------------------------------------------------

const RATE_LIMIT = { maxPerHour: 30, maxPerDay: 120 } as const;

const rateBuckets = new Map<string, { hour: number[]; day: number[] }>();

/**
 * Duplicate cooldown — verification / reset / welcome mail must never
 * double-fire when a client retries a request (or a user double-clicks).
 * In-memory by design: it protects the window that matters (seconds), needs
 * no index, and resets harmlessly across instances.
 */
const recentSends = new Map<string, number>();

function rememberSend(key: string, nowMs: number): void {
  if (recentSends.size > 500) {
    for (const [k, at] of recentSends) {
      if (nowMs - at > 3_600_000) recentSends.delete(k);
    }
  }
  recentSends.set(key, nowMs);
}

function checkRateLimit(recipient: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const bucket = rateBuckets.get(recipient) ?? { hour: [], day: [] };
  bucket.hour = bucket.hour.filter(t => now - t < 3_600_000);
  bucket.day = bucket.day.filter(t => now - t < 86_400_000);

  if (bucket.hour.length >= RATE_LIMIT.maxPerHour) {
    return { ok: false, reason: 'Hourly email limit reached for this recipient.' };
  }
  if (bucket.day.length >= RATE_LIMIT.maxPerDay) {
    return { ok: false, reason: 'Daily email limit reached for this recipient.' };
  }

  bucket.hour.push(now);
  bucket.day.push(now);
  rateBuckets.set(recipient, bucket);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Core send
// ---------------------------------------------------------------------------

export interface SendTemplateOptions {
  templateKey: string;
  vars: Record<string, string | undefined>;
  category: EmailCategory;
  to: string;
  /** Logged for admin correlation; not shown in the mail itself. */
  userId?: string;
  /** Overrides the category mailbox as sender (admin sends choose directly). */
  fromOverride?: string;
  /** Overrides the rendered subject. */
  subjectOverride?: string;
  /** Skip the duplicate cooldown (explicit human-triggered test sends). */
  ignoreCooldown?: boolean;
  /** 1 = the first delivery attempt (the default); >1 = a retry runner call. */
  attempt?: number;
  /** Set by the retry runner so a failure updates its job instead of adding one. */
  retryJobId?: string;
  /** Escape hatch: set false to never enqueue a retry for this send. */
  enqueueRetry?: boolean;
}

export interface SendTemplateResult {
  ok: boolean;
  status: EmailStatus;
  logId?: string;
  providerId?: string;
  error?: string;
  /** Safe error category when the send failed. */
  errorClass?: string;
  /** True when the message was captured in dev mode (not actually sent). */
  devCaptured?: boolean;
  /** True when the send was skipped by the duplicate cooldown. */
  skippedDuplicate?: boolean;
}

async function writeEmailLog(entry: Omit<EmailLogEntry, 'id' | 'createdAt'>): Promise<string | undefined> {
  // Self-hosting migration: when PocketBase is configured on this server the
  // delivery log lives there; otherwise (and on any PB failure) Firestore
  // keeps receiving it exactly as before.
  const pbId = await pbWriteEmailLog(entry);
  if (pbId) return pbId;
  const db = getDb();
  if (!db) return undefined;
  try {
    const ref = await db.collection('emailLogs').add({ ...entry, createdAt: new Date() });
    return ref.id;
  } catch (error) {
    console.error('[email] failed to write delivery log:', error);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Retry scheduling — the bridge from a failed send to the durable queue.
// ---------------------------------------------------------------------------

async function maybeScheduleRetry(params: {
  mode: 'development' | 'production';
  options: SendTemplateOptions;
  from: string;
  errorClass: string;
  note?: string | undefined;
  db: FirestoreLike | null;
}): Promise<void> {
  try {
    const attempts = Math.max(1, params.options.attempt ?? 1);
    const decision = shouldRetry({
      templateKey: params.options.templateKey,
      attempts,
      errorClass: params.errorClass,
      mode: params.mode,
    });
    if (!decision.retry || !params.db) return;

    const lastError = (params.note ?? '').slice(0, 300);
    const nextAttemptAt = nextAttemptIso(Date.now(), attempts);

    if (params.options.retryJobId) {
      await updateRetryJob(params.db, params.options.retryJobId, {
        attempts,
        status: 'pending',
        nextAttemptAt,
        lastErrorClass: params.errorClass,
        lastError,
      });
      return;
    }
    if (params.options.enqueueRetry === false) return;

    await enqueueRetryJob(params.db, {
      to: params.options.to,
      from: params.from,
      templateKey: params.options.templateKey,
      category: params.options.category,
      vars: params.options.vars,
      userId: params.options.userId,
      errorClass: params.errorClass,
      lastError,
      nextAttemptAt,
    });
  } catch {
    // A queue hiccup must never mask the send result already reported.
  }
}

export async function sendTemplateEmail(options: SendTemplateOptions): Promise<SendTemplateResult> {
  const cfg = getVidnovConfig();
  const tpl: EmailTemplateDef | undefined = getTemplate(options.templateKey);
  if (!tpl) {
    return { ok: false, status: 'FAILED', error: `Unknown template: ${options.templateKey}` };
  }

  // Fill defaults so templates always render complete.
  const vars: Record<string, string | undefined> = {
    app_url: cfg.appUrl,
    support_email: cfg.mailAddresses.support,
    created_at: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    ...options.vars,
  };

  const subject = options.subjectOverride ?? tpl.subject;
  const rendered = renderTemplate(subject + '\n' + tpl.body, vars);
  const from = options.fromOverride ?? mailboxFor(tpl.category);

  const message: OutgoingEmail = {
    to: options.to,
    from,
    replyTo: cfg.emailReplyTo,
    subject: rendered.subject ?? subject,
    text: rendered.text,
    html: rendered.html,
    templateKey: tpl.key,
  };

  // ----- Duplicate cooldown: verification / reset / welcome never double-fire -----
  const nowMs = Date.now();
  const cooldownKey = `${tpl.key}:${normalizeAddress(options.to)}`;
  if (!options.ignoreCooldown && hasDuplicateCooldown(tpl.key, recentSends.get(cooldownKey) ?? null, nowMs)) {
    await writeEmailLog({
      to: options.to,
      from,
      subject: message.subject,
      template: tpl.key,
      category: tpl.category,
      status: 'SKIPPED',
      provider: cfg.emailProvider || 'none',
      failureReason: 'Duplicate within the cooldown window — not sent again.',
      errorClass: 'duplicate',
      userId: options.userId,
      devMode: cfg.emailMode !== 'production',
    });
    return { ok: true, status: 'SKIPPED', skippedDuplicate: true };
  }

  // ----- Development mode: capture, never send -----
  if (cfg.emailMode === 'development') {
    const devDoc = {
      ...message,
      templateKey: tpl.key,
      category: tpl.category,
      userId: options.userId ?? null,
      capturedAt: new Date(),
      devMode: true,
    };
    // Prefer PocketBase capture when configured; fall back to Firestore.
    let id: string | undefined;
    id = (await pbWriteDevMailbox({
      to: message.to,
      from: message.from,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      templateKey: tpl.key,
      category: tpl.category,
      userId: options.userId ?? null,
    })) ?? undefined;
    if (!id) {
      const db = getDb();
      if (db) {
        try {
          const ref = await (db.collection as any)('devMailbox').add(devDoc);
          id = ref.id;
        } catch (error) {
          console.error('[email] failed to capture dev mail:', error);
        }
      }
    }
    await writeEmailLog({
      to: options.to,
      from,
      subject: message.subject,
      template: tpl.key,
      category: tpl.category,
      status: 'SENT',
      provider: 'dev-mailbox',
      providerId: id,
      userId: options.userId,
      devMode: true,
    });
    console.log(`[email:dev] captured "${tpl.key}" to ${options.to} (not sent)`);
    return { ok: true, status: 'SENT', logId: id, devCaptured: true };
  }

  // ----- Production mode -----
  // Hard-bounce suppression: a permanently bouncing recipient is refused
  // BEFORE any provider call — permanent problems are never retried and
  // never re-attempted by hand from the queue.
  const prodDb = getDb();
  if (prodDb) {
    const suppression = await isSuppressed(prodDb, options.to);
    if (suppression.suppressed) {
      const reason = 'Recipient is suppressed after a permanent bounce.';
      await writeEmailLog({
        to: options.to, from, subject: message.subject, template: tpl.key,
        category: tpl.category, status: 'FAILED', provider: cfg.emailProvider || 'none',
        failureReason: reason, errorClass: 'suppressed', userId: options.userId, devMode: false,
      });
      return { ok: false, status: 'FAILED', errorClass: 'suppressed', error: reason };
    }
  }

  const rate = checkRateLimit(options.to);
  if (!rate.ok) {
    await writeEmailLog({
      to: options.to, from, subject: message.subject, template: tpl.key,
      category: tpl.category, status: 'FAILED', provider: cfg.emailProvider || 'none',
      failureReason: rate.reason, errorClass: 'rate_limited', userId: options.userId, devMode: false,
    });
    return { ok: false, status: 'FAILED', errorClass: 'rate_limited', error: rate.reason };
  }

  const provider = getEmailProvider(cfg.emailProvider, cfg.emailApiKey, cfg.emailMode);
  await writeEmailLog({
    to: options.to, from, subject: message.subject, template: tpl.key,
    category: tpl.category, status: 'SENDING', provider: provider.id,
    userId: options.userId, devMode: false,
  });

  try {
    const result = await provider.send(message);
    if (result.accepted) {
      rememberSend(cooldownKey, nowMs);
      await writeEmailLog({
        to: options.to, from, subject: message.subject, template: tpl.key,
        category: tpl.category, status: 'SENT', provider: provider.id,
        providerId: result.providerId, userId: options.userId, devMode: false,
      });
      return { ok: true, status: 'SENT', providerId: result.providerId };
    }

    // HONESTY: `accepted` is NOT `delivered`. The log stops at SENT until a
    // provider webhook proves DELIVERED (or BOUNCED).
    const errorClass = classifySendError(result.httpStatus, result.error);
    await writeEmailLog({
      to: options.to, from, subject: message.subject, template: tpl.key,
      category: tpl.category, status: 'FAILED', provider: provider.id,
      providerId: result.providerId, userId: options.userId,
      failureReason: result.error, errorClass, devMode: false,
    });
    await maybeScheduleRetry({
      mode: cfg.emailMode, options, from, errorClass, note: result.error, db: prodDb,
    });
    return { ok: false, status: 'FAILED', providerId: result.providerId, errorClass, error: result.error };
  } catch (error: unknown) {
    const errorClass = classifyThrown(error);
    const note = error instanceof Error ? error.message : 'provider error';
    await writeEmailLog({
      to: options.to, from, subject: message.subject, template: tpl.key,
      category: tpl.category, status: 'FAILED', provider: provider.id,
      failureReason: note, errorClass, userId: options.userId, devMode: false,
    });
    await maybeScheduleRetry({ mode: cfg.emailMode, options, from, errorClass, note, db: prodDb });
    return { ok: false, status: 'FAILED', errorClass, error: note };
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers used across the app
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(userEmail: string, resetLink: string, userName?: string): Promise<SendTemplateResult> {
  return sendTemplateEmail({
    templateKey: 'password-reset',
    category: 'account',
    to: userEmail,
    vars: { user_name: userName, reset_link: resetLink },
  });
}

export async function sendVerificationEmail(userEmail: string, verificationLink: string, userName?: string): Promise<SendTemplateResult> {
  return sendTemplateEmail({
    templateKey: 'verify-email',
    category: 'account',
    to: userEmail,
    vars: { user_name: userName, verification_link: verificationLink },
  });
}

export async function sendWelcomeEmail(userEmail: string, userName?: string): Promise<SendTemplateResult> {
  return sendTemplateEmail({
    templateKey: 'welcome',
    category: 'account',
    to: userEmail,
    vars: { user_name: userName, verification_link: appLink('/dashboard') },
  });
}

export async function sendPasswordChangedEmail(userEmail: string, userName?: string): Promise<SendTemplateResult> {
  return sendTemplateEmail({
    templateKey: 'password-changed',
    category: 'account',
    to: userEmail,
    vars: { user_name: userName },
  });
}

export async function sendNewLoginAlert(
  userEmail: string,
  details: { device: string; location?: string; userName?: string },
): Promise<SendTemplateResult> {
  return sendTemplateEmail({
    templateKey: 'new-login',
    category: 'account',
    to: userEmail,
    vars: { user_name: details.userName, device: details.device, location: details.location ?? 'Unknown' },
  });
}
