'use client';

/**
 * CHAT API CLIENT — the only way the browser talks to the message section.
 *
 * Every request goes through the same authed layer the rest of the app uses
 * (Bearer ID token minted by `firebase/auth`), and every response is data this
 * server already validated. The client never sends a uid, a participant list,
 * a preview text or a counter: those are decided server-side.
 *
 * ## Why a shim for timestamps
 *
 * The chat surfaces render `ts.toDate()` / `ts.toMillis()` — the shape
 * Firestore's `Timestamp` used to hand them. Rather than rewrite every bubble
 * and inbox row during the migration, the ISO strings the API returns are
 * wrapped in the same two-method shape here, at the single point where data
 * enters the components. Nothing in this section reads or writes Firestore.
 */

import type { User } from 'firebase/auth';
import type { Chat, ChatMessage } from '@/lib/types';

/** The subset of a Firestore `Timestamp` the chat UI actually calls. */
export interface ChatTime {
  toDate: () => Date;
  toMillis: () => number;
}

/** Wrap an ISO string (or an already-converted value) in `toDate`/`toMillis`. */
export function chatTime(value: unknown): ChatTime | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'object' && 'toDate' in (value as object)) {
    return value as ChatTime;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return undefined;
  const ms = parsed.getTime();
  return { toDate: () => parsed, toMillis: () => ms };
}

async function headers(user: User): Promise<Record<string, string>> {
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) {
    const message = body.error || body.message || `Request failed (${res.status})`;
    throw new ChatApiError(message, res.status);
  }
  return body as T;
}

/** Error carrying the HTTP status so callers can tell 503 from a validation 400. */
export class ChatApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ChatApiError';
    this.status = status;
  }
}

function normalizeChat(raw: Chat & { lastMessageTimestamp?: unknown }): Chat {
  return { ...raw, lastMessageTimestamp: chatTime(raw.lastMessageTimestamp) };
}

function normalizeMessage(raw: ChatMessage & { timestamp?: unknown; readAt?: unknown }): ChatMessage {
  return { ...raw, timestamp: chatTime(raw.timestamp), readAt: chatTime(raw.readAt) };
}

/** Every conversation for the caller (`scope: 'all'` is admin-only). */
export async function fetchChats(user: User, scope: 'mine' | 'all' = 'mine'): Promise<Chat[]> {
  const qs = scope === 'all' ? '?scope=all' : '';
  const res = await fetch(`/api/chat${qs}`, { headers: await headers(user), cache: 'no-store' });
  const data = await parse<{ chats?: Chat[] }>(res);
  return (data.chats ?? []).map(normalizeChat);
}

/** Open (or reuse) the 1:1 conversation with another user. Idempotent. */
export async function openChat(
  user: User,
  participantId: string,
  seedMessage = '',
): Promise<Chat> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: await headers(user),
    body: JSON.stringify({ participantId, seedMessage }),
  });
  const data = await parse<{ chat: Chat }>(res);
  return normalizeChat(data.chat);
}

/** The thread for one conversation, oldest → newest. */
export async function fetchMessages(user: User, chatId: string, limit = 200): Promise<ChatMessage[]> {
  const res = await fetch(
    `/api/chat/${encodeURIComponent(chatId)}/messages?limit=${limit}`,
    { headers: await headers(user), cache: 'no-store' },
  );
  const data = await parse<{ messages?: ChatMessage[] }>(res);
  return (data.messages ?? []).map(normalizeMessage);
}

export interface SendMessagePayload {
  messageType: ChatMessage['messageType'];
  messageText?: string;
  mediaUrl?: string;
  mediaMetadata?: ChatMessage['mediaMetadata'];
  productId?: string;
  orderId?: string;
}

/**
 * Send one message. `clientMsgId` is minted here from the browser's uuid so a
 * retry (the caller re-invoking with the SAME id) cannot post twice — pass the
 * id of a failed attempt when retrying deliberately.
 */
export async function sendChatMessage(
  user: User,
  chatId: string,
  payload: SendMessagePayload,
  clientMsgId?: string,
): Promise<ChatMessage> {
  const id = (clientMsgId ?? newMessageId()).slice(0, 35);
  const res = await fetch(`/api/chat/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers: await headers(user),
    body: JSON.stringify({ clientMsgId: id, ...payload }),
  });
  const data = await parse<{ message: ChatMessage }>(res);
  return normalizeMessage(data.message);
}

/** A 32-char hex id — fits PocketBase's 35-char record id limit. */
export function newMessageId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
  return uuid.replace(/-/g, '');
}

/** `read` clears my badge, `hide` drops it from my inbox, `restore` brings it back. */
export async function patchChat(
  user: User,
  chatId: string,
  action: 'read' | 'hide' | 'restore',
): Promise<void> {
  const res = await fetch(`/api/chat/${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    headers: await headers(user),
    body: JSON.stringify({ action }),
  });
  await parse<{ ok?: boolean }>(res);
}

/** Remove one of MY messages from a conversation. */
export async function deleteChatMessage(
  user: User,
  chatId: string,
  messageId: string,
): Promise<void> {
  const res = await fetch(
    `/api/chat/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE', headers: await headers(user) },
  );
  await parse<{ ok?: boolean }>(res);
}
