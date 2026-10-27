/**
 * CHAT STORE — the VPS-controlled data layer for the message section.
 *
 * ## Storage method
 *
 * Conversations and messages live in **PocketBase on our VPS** (`chats` and
 * `chat_messages`), reached over HTTP as the superuser — the same migration
 * path notifications, orders, products, wallet and live sessions already use.
 * Nothing here writes to Firebase: the whole point of this section's move is
 * that a conversation, and every photo / video / voice note it references, is
 * owned by this server.
 *
 * Unlike the mirror-style stores (which keep Firestore as a second copy), this
 * module has **no Firestore fallback on purpose**. A silent fallback would put
 * new messages straight back into Firebase and undo the migration the moment
 * the VPS is misconfigured. Instead, `messagingConfigured()` reports whether
 * PocketBase is available and the API route answers 503 with an actionable
 * message, so a missing env var is visible instead of invisible.
 *
 * ## Ownership is enforced HERE, not by the client
 *
 * Collections are created with empty API rules (superuser-only), so the ONLY
 * thing standing between one user and somebody else's conversation is the
 * membership check in this file. Every route re-derives the sender from the
 * verified ID token and calls these helpers; no participant list, seller id or
 * counter is ever read from the request body.
 *
 * ## The `deletedFor` contract (fixed here)
 *
 * The old client-side implementation reset the SHARED `deletedFor` array to
 * `[]` on every send, so one participant's "delete this chat" was erased by
 * the other participant's next message (the clobber documented in
 * `src/tests/chat-vanish-repro.test.ts`). Here `hide` appends one uid and a
 * send only removes the SENDER's own uid — a hide can never be undone by
 * somebody else.
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pbRequest,
  pocketBaseEnabled,
  type PbField,
  type PbRecord,
} from '@/lib/pocketbase/server';
import type { Chat, ChatMessage } from '@/lib/types';
import type { ChatMessageInput } from './validate';

export const CHATS_COLLECTION = 'chats';
export const MESSAGES_COLLECTION = 'chat_messages';

/** Cap on one inbox / thread fetch — a thread keeps its newest N messages. */
export const MAX_LISTED_CHATS = 200;
export const MAX_LISTED_MESSAGES = 500;

const CHAT_FIELDS: PbField[] = [
  // Sorted pair: lets the store ask "is uid in this chat?" with two text
  // comparisons instead of a JSON containment filter PocketBase cannot index.
  { name: 'participantA', type: 'text', required: true },
  { name: 'participantB', type: 'text', required: true },
  { name: 'participantIds', type: 'json' },
  { name: 'lastMessage', type: 'text' },
  { name: 'lastMessageTimestamp', type: 'date' },
  { name: 'deletedFor', type: 'json' },
  { name: 'unreadCounts', type: 'json' },
  { name: 'createdAt', type: 'date' },
];

const MESSAGE_FIELDS: PbField[] = [
  { name: 'chatId', type: 'text', required: true },
  { name: 'senderId', type: 'text', required: true },
  { name: 'messageType', type: 'text' },
  { name: 'messageText', type: 'text' },
  { name: 'mediaUrl', type: 'text' },
  { name: 'mediaMetadata', type: 'json' },
  { name: 'productId', type: 'text' },
  { name: 'orderId', type: 'text' },
  { name: 'isRead', type: 'bool' },
  { name: 'readAt', type: 'date' },
  { name: 'timestamp', type: 'date' },
];

/** Thrown when PocketBase is unavailable — the route maps it to HTTP 503. */
export class MessagingUnavailableError extends Error {
  constructor(message = 'Messaging storage is not configured on this server.') {
    super(message);
    this.name = 'MessagingUnavailableError';
  }
}

let ensurePromise: Promise<void> | null = null;

/** Creates both collections once per process; idempotent and diff-aware. */
function ensureChatCollections(): Promise<void> {
  if (!pocketBaseEnabled()) return Promise.reject(new MessagingUnavailableError());
  if (!ensurePromise) {
    ensurePromise = Promise.all([
      ensureCollection(CHATS_COLLECTION, CHAT_FIELDS),
      ensureCollection(MESSAGES_COLLECTION, MESSAGE_FIELDS),
    ])
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null; // a failed ensure must not poison every later call
        throw err;
      });
  }
  return ensurePromise;
}

/** True when conversations can be read/written on the VPS. */
export function messagingConfigured(): boolean {
  return pocketBaseEnabled();
}

/** Escape a value for a PocketBase filter literal. */
const esc = (value: string): string => value.replace(/([\\'])/g, '\\$1');

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function stringMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

/** PocketBase record → the `Chat` shape the inbox already renders. */
export function toChat(record: PbRecord): Chat {
  return {
    id: record.id,
    participantIds: strArray(record.participantIds),
    lastMessage: str(record.lastMessage) || undefined,
    lastMessageTimestamp: str(record.lastMessageTimestamp) || undefined,
    deletedFor: strArray(record.deletedFor),
    unreadCounts: stringMap(record.unreadCounts),
  };
}

/** PocketBase record → the `ChatMessage` shape the thread already renders. */
export function toMessage(record: PbRecord): ChatMessage {
  const metadata = record.mediaMetadata;
  return {
    id: record.id,
    senderId: str(record.senderId),
    messageText: str(record.messageText) || undefined,
    timestamp: str(record.timestamp) || undefined,
    messageType: (str(record.messageType) || 'text') as ChatMessage['messageType'],
    mediaUrl: str(record.mediaUrl) || undefined,
    mediaMetadata:
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as ChatMessage['mediaMetadata'])
        : undefined,
    productId: str(record.productId) || undefined,
    orderId: str(record.orderId) || undefined,
    isRead: record.isRead === true || record.isRead === 'true',
    readAt: str(record.readAt) || undefined,
  };
}

async function getRecord(collection: string, id: string): Promise<PbRecord | null> {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(id)) return null;
  const res = await pbRequest(`/api/collections/${encodeURIComponent(collection)}/records/${id}`);
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as PbRecord | null;
}

/* --------------------------------------------------------------------------- */
/* Reads                                                                        */
/* --------------------------------------------------------------------------- */

export interface ListChatsOptions {
  /** Admin console: every conversation, not just the caller's. */
  all?: boolean;
  limit?: number;
}

/** The caller's conversations (or every one for an admin), newest first. */
export async function listChats(uid: string, options: ListChatsOptions = {}): Promise<Chat[]> {
  await ensureChatCollections();
  const limit = Math.min(Math.max(options.limit ?? MAX_LISTED_CHATS, 1), MAX_LISTED_CHATS);
  const filter = options.all
    ? `participantA != "" || participantB != ""`
    : `(participantA = "${esc(uid)}" || participantB = "${esc(uid)}")`;
  const rows = await pbListRecords(CHATS_COLLECTION, {
    filter,
    sort: '-lastMessageTimestamp',
    perPage: limit,
  });
  return rows.map(toChat);
}

export async function getChat(chatId: string): Promise<Chat | null> {
  await ensureChatCollections();
  const record = await getRecord(CHATS_COLLECTION, chatId);
  return record ? toChat(record) : null;
}

/**
 * Membership test for paths that must not leak: the media engine asks this
 * before it will store a file under `chats/<chatId>/`.
 */
export async function isChatParticipant(chatId: string, uid: string): Promise<boolean> {
  if (!messagingConfigured()) return false;
  try {
    const chat = await getChat(chatId);
    return !!chat && chat.participantIds.includes(uid);
  } catch {
    return false;
  }
}

export async function listMessages(chatId: string, limit = 200): Promise<ChatMessage[]> {
  await ensureChatCollections();
  const perPage = Math.min(Math.max(limit, 1), MAX_LISTED_MESSAGES);
  const rows = await pbListRecords(MESSAGES_COLLECTION, {
    filter: `chatId = "${esc(chatId)}"`,
    sort: '-timestamp',
    perPage,
  });
  // Newest page fetched backwards, then flipped so the thread renders oldest →
  // newest exactly like the query the Firestore implementation used.
  return rows.reverse().map(toMessage);
}

/* --------------------------------------------------------------------------- */
/* Conversations                                                                */
/* --------------------------------------------------------------------------- */

const newId = (): string => {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  return uuid.replace(/-/g, '').slice(0, 32);
};

/**
 * Open (or reuse) the 1:1 conversation between two users.
 *
 * Idempotent: participants are sorted, so A→B and B→A find the same row, and
 * a repeated call never creates a second conversation.
 */
export async function ensureConversation(
  uidA: string,
  uidB: string,
  seedMessage = '',
): Promise<Chat> {
  await ensureChatCollections();
  if (!uidA || !uidB || uidA === uidB) throw new Error('Invalid conversation.');

  const [a, b] = [uidA, uidB].sort();
  const existing = await pbListRecords(CHATS_COLLECTION, {
    filter: `participantA = "${esc(a)}" && participantB = "${esc(b)}"`,
    perPage: 1,
  });
  if (existing[0]) {
    const chat = toChat(existing[0]);
    // Re-opening a chat I hid must clear MY flag only (never the other side's).
    if (chat.deletedFor?.includes(uidA)) {
      return (await hideOrRestore(chat.id, uidA, 'restore')) ?? chat;
    }
    return chat;
  }

  const now = new Date().toISOString();
  const created = await pbCreateRecord(CHATS_COLLECTION, {
    id: newId(),
    participantA: a,
    participantB: b,
    participantIds: [uidA, uidB],
    lastMessage: seedMessage.slice(0, 140),
    lastMessageTimestamp: now,
    deletedFor: [],
    unreadCounts: {},
    createdAt: now,
  });
  return toChat(created);
}

/** Adds (or removes) the caller's own hide flag. Returns the updated chat. */
export async function hideOrRestore(
  chatId: string,
  uid: string,
  action: 'hide' | 'restore',
): Promise<Chat | null> {
  await ensureChatCollections();
  const record = await getRecord(CHATS_COLLECTION, chatId);
  if (!record) return null;
  const chat = toChat(record);
  if (!chat.participantIds.includes(uid)) return null;

  const current = chat.deletedFor ?? [];
  const next =
    action === 'hide'
      ? Array.from(new Set([...current, uid]))
      : current.filter((id) => id !== uid);
  if (next.length === current.length && next.every((id, i) => id === current[i])) return chat;

  const res = await pbRequest(
    `/api/collections/${CHATS_COLLECTION}/records/${chatId}`,
    { method: 'PATCH', body: JSON.stringify({ deletedFor: next }) },
  );
  if (!res.ok) throw new Error(`Could not update that conversation (${res.status}).`);
  return { ...chat, deletedFor: next };
}

/**
 * Marks every message the caller has not read as read and clears their badge.
 * One filtered batch PATCH — the caller never sends a list of message ids.
 */
export async function markChatRead(chatId: string, uid: string): Promise<boolean> {
  await ensureChatCollections();
  const chat = await getChat(chatId);
  if (!chat || !chat.participantIds.includes(uid)) return false;

  const now = new Date().toISOString();
  const res = await pbRequest(
    `/api/collections/${MESSAGES_COLLECTION}/records?filter=${encodeURIComponent(
      `chatId = "${esc(chatId)}" && senderId != "${esc(uid)}" && isRead = false`,
    )}`,
    { method: 'PATCH', body: JSON.stringify({ isRead: true, readAt: now }) },
  );
  if (!res.ok && res.status !== 404) throw new Error(`Could not mark the conversation read (${res.status}).`);

  const unread = { ...(chat.unreadCounts ?? {}) };
  if (unread[uid]) {
    delete unread[uid];
    await pbRequest(`/api/collections/${CHATS_COLLECTION}/records/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ unreadCounts: unread }),
    });
  }
  return true;
}

/* --------------------------------------------------------------------------- */
/* Messages                                                                     */
/* --------------------------------------------------------------------------- */

/**
 * Append one validated message and roll the conversation forward.
 *
 * The record id IS the client's `clientMsgId`, so a retried send collides
 * with itself instead of creating a second message: a duplicate id returns the
 * message that already exists.
 */
export async function appendMessage(
  chatId: string,
  senderId: string,
  input: ChatMessageInput,
  preview: string,
): Promise<{ message: ChatMessage; duplicate: boolean }> {
  await ensureChatCollections();
  const chat = await getChat(chatId);
  if (!chat) throw new Error('Conversation not found.');
  if (!chat.participantIds.includes(senderId)) throw new Error('You are not part of this conversation.');

  const now = new Date().toISOString();
  const record = await getRecord(MESSAGES_COLLECTION, input.clientMsgId).catch(() => null);
  if (record && record.chatId === chatId && record.senderId === senderId) {
    return { message: toMessage(record), duplicate: true };
  }

  const message = await pbCreateRecord(MESSAGES_COLLECTION, {
    id: input.clientMsgId,
    chatId,
    senderId,
    messageType: input.messageType,
    messageText: input.messageText ?? '',
    mediaUrl: input.mediaUrl ?? '',
    mediaMetadata: input.mediaMetadata ?? null,
    productId: input.productId ?? '',
    orderId: input.orderId ?? '',
    isRead: false,
    readAt: null,
    timestamp: now,
  }).catch(async (err: unknown) => {
    // Lost the race to a concurrent retry of the same message — fetch ours.
    const existing = await getRecord(MESSAGES_COLLECTION, input.clientMsgId).catch(() => null);
    if (existing) return existing;
    throw err;
  });

  const unread = { ...(chat.unreadCounts ?? {}) };
  const otherId = chat.participantIds.find((id) => id !== senderId);
  if (otherId) unread[otherId] = (unread[otherId] ?? 0) + 1;

  // A send clears ONLY the sender's own hide flag. Somebody else's "delete
  // this chat" survives my message — the clobber the old client had.
  const deletedFor = (chat.deletedFor ?? []).filter((id) => id !== senderId);

  const res = await pbRequest(`/api/collections/${CHATS_COLLECTION}/records/${chatId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      lastMessage: preview.slice(0, 140),
      lastMessageTimestamp: now,
      deletedFor,
      unreadCounts: unread,
    }),
  });
  if (!res.ok) {
    // The message itself is stored; a failed preview update must not fail the
    // send, but it must be visible in the logs rather than silently stale.
    console.error(`[chat] could not update conversation preview (${res.status})`);
  }

  return { message: toMessage(message as PbRecord), duplicate: false };
}

/** Deletes one message. Only its sender may remove it. */
export async function deleteMessage(chatId: string, messageId: string, uid: string): Promise<boolean> {
  await ensureChatCollections();
  const record = await getRecord(MESSAGES_COLLECTION, messageId);
  if (!record) return false;
  if (str(record.chatId) !== chatId) return false;
  if (str(record.senderId) !== uid) return false;
  const res = await pbRequest(
    `/api/collections/${MESSAGES_COLLECTION}/records/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  );
  return res.ok || res.status === 404;
}
