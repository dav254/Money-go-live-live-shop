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

export type EmailStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';

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
  devMode: boolean;
  createdAt: unknown;
}

/** Minimal Firestore write contract so this module stays testable. */
export interface FirestoreLike {
  collection(path: string): {
    add(data: unknown): Promise<{ id: string }>;
  };
}

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
}

export interface SendTemplateResult {
  ok: boolean;
  status: EmailStatus;
  logId?: string;
  providerId?: string;
  error?: string;
  /** True when the message was captured in dev mode (not actually sent). */
  devCaptured?: boolean;
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
  const rate = checkRateLimit(options.to);
  if (!rate.ok) {
    await writeEmailLog({
      to: options.to, from, subject: message.subject, template: tpl.key,
      category: tpl.category, status: 'FAILED', provider: cfg.emailProvider || 'none',
      failureReason: rate.reason, userId: options.userId, devMode: false,
    });
    return { ok: false, status: 'FAILED', error: rate.reason };
  }

  const provider = getEmailProvider(cfg.emailProvider, cfg.emailApiKey);
  await writeEmailLog({
    to: options.to, from, subject: message.subject, template: tpl.key,
    category: tpl.category, status: 'SENDING', provider: provider.id,
    userId: options.userId, devMode: false,
  });

  try {
    const result = await provider.send(message);
    const status: EmailStatus = result.accepted ? 'SENT' : 'FAILED';
    await writeEmailLog({
      to: options.to, from, subject: message.subject, template: tpl.key,
      category: tpl.category, status, provider: provider.id,
      providerId: result.providerId, userId: options.userId,
      failureReason: result.error, devMode: false,
    });
    return { ok: result.accepted, status, providerId: result.providerId, error: result.error };
  } catch (error: any) {
    await writeEmailLog({
      to: options.to, from, subject: message.subject, template: tpl.key,
      category: tpl.category, status: 'FAILED', provider: provider.id,
      failureReason: error?.message ?? 'unknown provider error', userId: options.userId, devMode: false,
    });
    return { ok: false, status: 'FAILED', error: error?.message ?? 'provider error' };
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
