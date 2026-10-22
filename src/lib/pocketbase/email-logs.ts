/**
 * Email log / dev mailbox storage — first section of the Firestore →
 * PocketBase self-hosting migration.
 *
 * Rule of this migration: every helper here returns `null`/`undefined` when
 * PocketBase is not configured (or errors), and the caller keeps its existing
 * Firestore behaviour. That makes each section safe to ship before the VPS
 * has PocketBase running, and gives us an instant rollback (unset the env
 * vars) without touching code.
 *
 * Collections (created automatically on first write):
 *   email_logs  — delivery log, same fields as the old Firestore collection
 *   dev_mailbox — EMAIL_MODE=development capture, same fields as devMailbox
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  type PbField,
} from './server';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const EMAIL_LOG_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text' }, // Firestore doc id — makes backfill re-runnable
  { name: 'to', type: 'text', required: true },
  { name: 'from', type: 'text', required: true },
  { name: 'subject', type: 'text' },
  { name: 'template', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'status', type: 'text', required: true },
  { name: 'provider', type: 'text' },
  { name: 'providerId', type: 'text' },
  { name: 'userId', type: 'text' },
  { name: 'failureReason', type: 'text' },
  { name: 'devMode', type: 'bool' },
  { name: 'createdAt', type: 'date' },
];

const DEV_MAILBOX_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text' },
  { name: 'to', type: 'text', required: true },
  { name: 'from', type: 'text', required: true },
  { name: 'replyTo', type: 'text' },
  { name: 'subject', type: 'text' },
  { name: 'text', type: 'text' },
  { name: 'html', type: 'text' },
  { name: 'templateKey', type: 'text' },
  { name: 'category', type: 'text' },
  { name: 'userId', type: 'text' },
  { name: 'capturedAt', type: 'date' },
  { name: 'devMode', type: 'bool' },
];

export const EMAIL_LOGS_COLLECTION = 'email_logs';
export const DEV_MAILBOX_COLLECTION = 'dev_mailbox';

// ---------------------------------------------------------------------------
// Writes — used by src/lib/notifications/email-service.ts
// ---------------------------------------------------------------------------

export interface EmailLogInput {
  to: string;
  from: string;
  subject: string;
  template: string;
  category: string;
  status: string;
  provider: string;
  providerId?: string;
  userId?: string;
  failureReason?: string;
  devMode: boolean;
}

/** Writes one delivery-log record. Returns the PB id, or null when PB is off/failed. */
export async function pbWriteEmailLog(entry: EmailLogInput): Promise<string | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(EMAIL_LOGS_COLLECTION, EMAIL_LOG_FIELDS);
    const rec = await pbCreateRecord(EMAIL_LOGS_COLLECTION, {
      ...entry,
      providerId: entry.providerId ?? null,
      userId: entry.userId ?? null,
      failureReason: entry.failureReason ?? null,
      createdAt: new Date().toISOString(),
    });
    return rec.id;
  } catch (error) {
    console.error('[pocketbase] email log write failed:', error);
    return null;
  }
}

export interface DevMailboxInput {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  templateKey: string;
  category: string;
  userId?: string | null;
}

/** Captures one dev-mode message. Returns the PB id, or null when PB is off/failed. */
export async function pbWriteDevMailbox(message: DevMailboxInput): Promise<string | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(DEV_MAILBOX_COLLECTION, DEV_MAILBOX_FIELDS);
    const rec = await pbCreateRecord(DEV_MAILBOX_COLLECTION, {
      ...message,
      replyTo: message.replyTo ?? null,
      userId: message.userId ?? null,
      capturedAt: new Date().toISOString(),
      devMode: true,
    });
    return rec.id;
  } catch (error) {
    console.error('[pocketbase] dev mailbox write failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reads — used by the admin Communication Center / Email Status APIs.
// Shapes match what those routes already return, so the UI is untouched.
// ---------------------------------------------------------------------------

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const t = value as { toDate?: () => Date };
  return t.toDate?.().toISOString() ?? null;
}

export interface EmailLogRow {
  id: string;
  to: string;
  from: string;
  subject: string;
  template: string;
  category: string;
  status: string;
  provider: string;
  providerId: string | null;
  failureReason: string | null;
  createdAt: string | null;
  devMode: boolean;
}

/** Recent delivery logs, newest first. Null when PB is off/failed. */
export async function pbListEmailLogs(limit: number, status?: string | null): Promise<EmailLogRow[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    const items = await pbListRecords(EMAIL_LOGS_COLLECTION, {
      sort: '-createdAt',
      perPage: limit,
      filter: status ? `status = '${status.replace(/'/g, "\\'")}'` : undefined,
    });
    return items.map((r) => ({
      id: r.id,
      to: String(r.to ?? ''),
      from: String(r.from ?? ''),
      subject: String(r.subject ?? ''),
      template: String(r.template ?? ''),
      category: String(r.category ?? ''),
      status: String(r.status ?? ''),
      provider: String(r.provider ?? ''),
      providerId: r.providerId != null ? String(r.providerId) : null,
      failureReason: r.failureReason != null ? String(r.failureReason) : null,
      createdAt: isoOrNull(r.createdAt),
      devMode: Boolean(r.devMode),
    }));
  } catch (error) {
    console.error('[pocketbase] email log read failed:', error);
    return null;
  }
}

export interface DevMailboxRow {
  id: string;
  to: string;
  from: string;
  subject: string;
  templateKey: string;
  category: string;
  capturedAt: string | null;
  text: string;
}

/** Recent dev-captured messages (full bodies, truncated at render). Null when PB is off/failed. */
export async function pbListDevMailbox(limit: number): Promise<DevMailboxRow[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    const items = await pbListRecords(DEV_MAILBOX_COLLECTION, { sort: '-capturedAt', perPage: limit });
    return items.map((r) => ({
      id: r.id,
      to: String(r.to ?? ''),
      from: String(r.from ?? ''),
      subject: String(r.subject ?? ''),
      templateKey: String(r.templateKey ?? ''),
      category: String(r.category ?? ''),
      capturedAt: isoOrNull(r.capturedAt),
      text: typeof r.text === 'string' ? r.text.slice(0, 2000) : '',
    }));
  } catch (error) {
    console.error('[pocketbase] dev mailbox read failed:', error);
    return null;
  }
}

/** Lightweight capture list for the Email Status page. Null when PB is off/failed. */
export async function pbListDevMailboxBrief(limit: number): Promise<{ id: string; to: string; subject: string; createdAt: string | null }[] | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    const items = await pbListRecords(DEV_MAILBOX_COLLECTION, {
      sort: '-capturedAt',
      perPage: limit,
      fields: 'to,subject,capturedAt',
    });
    return items.map((r) => ({
      id: r.id,
      to: String(r.to ?? '—'),
      subject: String(r.subject ?? '(no subject)'),
      createdAt: isoOrNull(r.capturedAt),
    }));
  } catch (error) {
    console.error('[pocketbase] dev mailbox read failed:', error);
    return null;
  }
}
