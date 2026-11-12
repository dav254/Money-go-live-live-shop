/**
 * ADMIN AI COMMAND CENTRE — persistence in PocketBase (VPS).
 *
 * Conversations, reports and the last Ollama outcome live next to the rest of
 * the application's local store, not in a new database. Why PocketBase:
 * the founder's Command Centre must keep working when Firestore is blocked or
 * over quota, exactly like the rest of the mobile surface.
 *
 * Long model answers are stored in the `data` JSON column on purpose: a
 * PocketBase text field has a length cap, and silently truncating a technical
 * report is worse than storing it in the column designed for documents.
 *
 * Every helper throws `pocketbase_unavailable` when the store is off; the
 * routes translate that into "history is unavailable, the answer is not".
 */

import {
  ensureCollection,
  ensureCollectionIndexes,
  pbCreateRecordKeyed,
  pbListRecords,
  pbRequest,
  pocketBaseEnabled,
  type PbField,
  type PbRecord,
} from './server';

export const CONVERSATIONS_COLLECTION = 'admin_ai_conversations';
export const MESSAGES_COLLECTION = 'admin_ai_messages';
export const REPORTS_COLLECTION = 'admin_ai_reports';
export const META_COLLECTION = 'admin_ai_meta';

const CONVERSATION_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'ownerId', type: 'text', required: true },
  { name: 'title', type: 'text' },
  { name: 'messageCount', type: 'number' },
  { name: 'createdAtMs', type: 'number' },
  { name: 'updatedAtMs', type: 'number' },
  { name: 'data', type: 'json' },
];

const MESSAGE_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'conversationId', type: 'text', required: true },
  { name: 'ownerId', type: 'text', required: true },
  { name: 'role', type: 'text' },
  { name: 'createdAtMs', type: 'number' },
  { name: 'data', type: 'json' },
];

const REPORT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'ownerId', type: 'text', required: true },
  { name: 'status', type: 'text' },
  { name: 'model', type: 'text' },
  { name: 'startedAtMs', type: 'number' },
  { name: 'completedAtMs', type: 'number' },
  { name: 'data', type: 'json' },
];

const META_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'data', type: 'json' },
];

export const ADMIN_AI_INDEXES: Record<string, string[]> = {
  [CONVERSATIONS_COLLECTION]: [
    'CREATE INDEX `idx_admin_ai_conversations_owner` ON `admin_ai_conversations` (`ownerId`, `updatedAtMs`)',
  ],
  [MESSAGES_COLLECTION]: [
    'CREATE INDEX `idx_admin_ai_messages_conversation` ON `admin_ai_messages` (`conversationId`, `createdAtMs`)',
  ],
  [REPORTS_COLLECTION]: [
    'CREATE INDEX `idx_admin_ai_reports_owner` ON `admin_ai_reports` (`ownerId`, `startedAtMs`)',
  ],
};

let schemaReady: Promise<void> | null = null;

export async function ensureAdminAiSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureCollection(CONVERSATIONS_COLLECTION, CONVERSATION_FIELDS);
      await ensureCollection(MESSAGES_COLLECTION, MESSAGE_FIELDS);
      await ensureCollection(REPORTS_COLLECTION, REPORT_FIELDS);
      await ensureCollection(META_COLLECTION, META_FIELDS);
      for (const [collection, statements] of Object.entries(ADMIN_AI_INDEXES)) {
        await ensureCollectionIndexes(collection, statements);
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export function adminAiStoreAvailable(): boolean {
  return pocketBaseEnabled();
}

function assertAvailable(): void {
  if (!pocketBaseEnabled()) {
    const error = new Error('PocketBase is not configured.');
    (error as Error & { code?: string }).code = 'pocketbase_unavailable';
    throw error;
  }
}

const esc = (value: string) => value.replace(/'/g, "\\'");

function toDocument(record: PbRecord): Record<string, unknown> {
  const data = record.data;
  const base =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return { ...base, id: String(record.fsId ?? record.id) };
}

/* ── Conversations ───────────────────────────────────────────────────────── */

export interface StoredConversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export async function saveConversation(doc: {
  id: string;
  ownerId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}): Promise<void> {
  assertAvailable();
  await ensureAdminAiSchema();
  const existing = await pbListRecords(CONVERSATIONS_COLLECTION, {
    filter: `fsId = '${esc(doc.id)}'`,
    perPage: 1,
  });
  const data = {
    ...doc,
    updatedAtMs: Date.parse(doc.updatedAt) || Date.now(),
    createdAtMs: Date.parse(doc.createdAt) || Date.now(),
  };

  if (existing[0]) {
    await pbRequest(
      `/api/collections/${CONVERSATIONS_COLLECTION}/records/${existing[0].id}`,
      { method: 'PATCH', body: JSON.stringify({ ...data, data }) },
    );
    return;
  }

  await pbCreateRecordKeyed(CONVERSATIONS_COLLECTION, doc.id, {
    fsId: doc.id,
    ownerId: doc.ownerId,
    title: doc.title.slice(0, 500),
    messageCount: doc.messageCount,
    createdAtMs: data.createdAtMs,
    updatedAtMs: data.updatedAtMs,
    data,
  });
}

export async function listConversations(ownerId: string, limit = 30): Promise<StoredConversation[]> {
  assertAvailable();
  await ensureAdminAiSchema();
  const rows = await pbListRecords(CONVERSATIONS_COLLECTION, {
    filter: `ownerId = '${esc(ownerId)}'`,
    sort: '-updatedAtMs',
    perPage: Math.min(50, Math.max(1, limit)),
  });
  return rows.map((row) => {
    const doc = toDocument(row);
    return {
      id: String(doc.id),
      title: String(doc.title ?? 'Conversation'),
      messageCount: Number(doc.messageCount ?? 0),
      createdAt: String(doc.createdAt ?? ''),
      updatedAt: String(doc.updatedAt ?? ''),
    };
  });
}

export async function getConversation(ownerId: string, id: string): Promise<StoredConversation | null> {
  assertAvailable();
  await ensureAdminAiSchema();
  const rows = await pbListRecords(CONVERSATIONS_COLLECTION, {
    filter: `fsId = '${esc(id)}' && ownerId = '${esc(ownerId)}'`,
    perPage: 1,
  });
  if (!rows[0]) return null;
  const doc = toDocument(rows[0]);
  return {
    id: String(doc.id),
    title: String(doc.title ?? 'Conversation'),
    messageCount: Number(doc.messageCount ?? 0),
    createdAt: String(doc.createdAt ?? ''),
    updatedAt: String(doc.updatedAt ?? ''),
  };
}

/* ── Messages ────────────────────────────────────────────────────────────── */

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  model?: string | null;
  latencyMs?: number | null;
}

export async function appendMessage(input: {
  id: string;
  conversationId: string;
  ownerId: string;
  message: StoredMessage;
}): Promise<void> {
  assertAvailable();
  await ensureAdminAiSchema();
  await pbCreateRecordKeyed(MESSAGES_COLLECTION, input.id, {
    fsId: input.id,
    conversationId: input.conversationId,
    ownerId: input.ownerId,
    role: input.message.role,
    createdAtMs: Date.parse(input.message.createdAt) || Date.now(),
    data: input.message,
  });
}

export async function listMessages(conversationId: string, limit = 100): Promise<StoredMessage[]> {
  assertAvailable();
  await ensureAdminAiSchema();
  const rows = await pbListRecords(MESSAGES_COLLECTION, {
    filter: `conversationId = '${esc(conversationId)}'`,
    sort: 'createdAtMs',
    perPage: Math.min(200, Math.max(1, limit)),
  });
  return rows.map((row) => {
    const doc = toDocument(row);
    const role = doc.role === 'assistant' || doc.role === 'system' ? doc.role : 'user';
    return {
      id: String(doc.id),
      role,
      content: String(doc.content ?? ''),
      createdAt: String(doc.createdAt ?? ''),
      model: typeof doc.model === 'string' ? doc.model : null,
      latencyMs: typeof doc.latencyMs === 'number' ? doc.latencyMs : null,
    };
  });
}

/* ── Reports (instruction tasks) ─────────────────────────────────────────── */

export interface StoredReport extends Record<string, unknown> {
  id: string;
  title: string;
  status: string;
  startedAt: string;
}

export async function saveReport(report: Record<string, unknown>): Promise<void> {
  assertAvailable();
  await ensureAdminAiSchema();
  const id = String(report.id ?? '');
  const startedAt = String(report.startedAt ?? '');
  const completedAt = typeof report.completedAt === 'string' ? report.completedAt : '';
  await pbCreateRecordKeyed(REPORTS_COLLECTION, id, {
    fsId: id,
    ownerId: String(report.ownerId ?? ''),
    status: String(report.status ?? 'completed'),
    model: String(report.model ?? ''),
    startedAtMs: Date.parse(startedAt) || Date.now(),
    completedAtMs: completedAt ? Date.parse(completedAt) || 0 : 0,
    data: report,
  });
}

export async function listReports(ownerId: string, limit = 25): Promise<StoredReport[]> {
  assertAvailable();
  await ensureAdminAiSchema();
  const rows = await pbListRecords(REPORTS_COLLECTION, {
    filter: `ownerId = '${esc(ownerId)}'`,
    sort: '-startedAtMs',
    perPage: Math.min(50, Math.max(1, limit)),
  });
  return rows.map((row) => toDocument(row) as StoredReport);
}

export async function getReport(ownerId: string, id: string): Promise<StoredReport | null> {
  assertAvailable();
  await ensureAdminAiSchema();
  const rows = await pbListRecords(REPORTS_COLLECTION, {
    filter: `fsId = '${esc(id)}' && ownerId = '${esc(ownerId)}'`,
    perPage: 1,
  });
  return rows[0] ? (toDocument(rows[0]) as StoredReport) : null;
}

/* ── Meta: last successful Ollama contact ────────────────────────────────── */

export async function readMeta(key: string): Promise<Record<string, unknown> | null> {
  assertAvailable();
  await ensureAdminAiSchema();
  const rows = await pbListRecords(META_COLLECTION, {
    filter: `fsId = '${esc(key)}'`,
    perPage: 1,
  });
  return rows[0] ? toDocument(rows[0]) : null;
}

export async function writeMeta(key: string, patch: Record<string, unknown>): Promise<void> {
  assertAvailable();
  await ensureAdminAiSchema();
  const current = await readMeta(key);
  const merged = { ...(current ?? {}), ...patch, id: key, updatedAt: new Date().toISOString() };
  const rows = await pbListRecords(META_COLLECTION, {
    filter: `fsId = '${esc(key)}'`,
    perPage: 1,
  });
  if (rows[0]) {
    await pbRequest(`/api/collections/${META_COLLECTION}/records/${rows[0].id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data: merged }),
    });
    return;
  }
  await pbCreateRecordKeyed(META_COLLECTION, key, { fsId: key, data: merged });
}
