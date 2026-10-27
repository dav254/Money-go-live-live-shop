/**
 * CHAT PAYLOAD VALIDATION — pure, dependency-free, server-enforced.
 *
 * Every message that reaches the VPS store goes through here first. The rules
 * are deliberately expressed without any Firebase, PocketBase or framework
 * import so they can be unit-tested directly and so the API route stays a thin
 * wrapper around one call.
 *
 * Two things this file exists to guarantee:
 *
 *  1. **Media lives on the VPS, never inline.** The old chat embedded photos
 *     and voice notes as `data:` URLs inside the message document, which is
 *     what put conversation bytes inside Firebase. A message may now only
 *     point at a file this server stored under `chats/<chatId>/`, so a
 *     `data:`, `blob:` or foreign `http(s)` URL is rejected outright.
 *
 *  2. **The client never decides what the preview says.** `lastMessage` is the
 *     text every inbox row renders, so it is derived here from the validated
 *     message rather than trusted from the request.
 */

export const MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'file',
  'product',
  'order',
  'voice',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

/** Longest text body accepted (chat bubbles wrap; this is ~500 words). */
export const MAX_TEXT_CHARS = 4000;
/** What the conversation list shows — the preview is cut here server-side. */
export const MAX_PREVIEW_CHARS = 140;
/** A stored media URL is a short relative path on this server, nothing else. */
export const MAX_MEDIA_URL_CHARS = 600;
export const MAX_METADATA_NAME_CHARS = 200;
export const MAX_METADATA_TYPE_CHARS = 100;
/** Ceiling for a single chat API body (text + small metadata, never bytes). */
export const MAX_REQUEST_BYTES = 64 * 1024;

/** Ids minted by this app: 32-char hex (a uuid without dashes) fits PB's 35. */
const SAFE_ID = /^[A-Za-z0-9_-]{16,35}$/;
const ENTITY_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;

export interface MediaMetadata {
  name: string;
  size: number;
  type: string;
  duration?: number;
}

export interface ChatMessageInput {
  /** Client-minted id, reused as the record id → a retry cannot double-send. */
  clientMsgId: string;
  messageType: MessageType;
  messageText?: string;
  mediaUrl?: string;
  mediaMetadata?: MediaMetadata;
  productId?: string;
  orderId?: string;
}

export type ValidationResult =
  | { ok: true; value: ChatMessageInput; preview: string }
  | { ok: false; error: string };

const fail = (error: string): ValidationResult => ({ ok: false, error });

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * True when `url` points at a file this server stored in THIS conversation's
 * own folder. Everything else — inline data, a blob from a failed upload, or
 * any external host — is refused, because a message body is not allowed to
 * carry bytes or link out to somebody else's CDN.
 */
export function isVpsMediaUrl(url: string, chatId: string): boolean {
  if (!url || url.length > MAX_MEDIA_URL_CHARS) return false;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(chatId)) return false;
  if (!url.startsWith('/')) return false;
  const prefix = `/api/media/file/chats/${chatId}/`;
  if (!url.startsWith(prefix)) return false;
  const rest = url.slice(prefix.length);
  if (!rest || rest.includes('..') || rest.includes('//')) return false;
  // One path segment: `<mediaId>.<ext>`, no traversal, no query tricks.
  return /^[A-Za-z0-9_.-]{1,120}$/.test(rest);
}

function normalizeMetadata(raw: unknown): MediaMetadata | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.slice(0, MAX_METADATA_NAME_CHARS) : 'attachment';
  const size = typeof input.size === 'number' && Number.isFinite(input.size) && input.size >= 0
    ? Math.floor(input.size)
    : 0;
  const type = typeof input.type === 'string' ? input.type.slice(0, MAX_METADATA_TYPE_CHARS) : '';
  const duration =
    typeof input.duration === 'number' && Number.isFinite(input.duration) && input.duration >= 0
      ? Math.min(Math.floor(input.duration), 86_400)
      : undefined;
  return duration === undefined ? { name, size, type } : { name, size, type, duration };
}

/** The inbox line shown for this message — derived, never trusted. */
export function buildPreview(type: MessageType, text?: string): string {
  switch (type) {
    case 'text':
      return (text ?? '').slice(0, MAX_PREVIEW_CHARS);
    case 'voice':
      return 'Voice note';
    case 'image':
      return 'Sent a photo';
    case 'video':
      return 'Sent a video';
    case 'product':
      return 'Shared a product';
    case 'order':
      return 'Shared an order';
    default:
      return 'Sent a file';
  }
}

/**
 * Validate one client message for one chat.
 *
 * `senderId` comes from the verified ID token (never the body) and is only
 * used to prove the sender is a participant before anything is written.
 */
export function validateMessageInput(
  raw: unknown,
  ctx: { chatId: string; senderId: string },
): ValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('Invalid message payload.');
  }
  if (!UID.test(ctx.senderId)) return fail('Invalid sender.');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(ctx.chatId)) return fail('Invalid conversation.');

  const body = raw as Record<string, unknown>;

  const clientMsgId = typeof body.clientMsgId === 'string' ? body.clientMsgId.trim() : '';
  if (!SAFE_ID.test(clientMsgId)) return fail('Invalid message id.');

  const messageType = body.messageType as MessageType;
  if (!MESSAGE_TYPES.includes(messageType)) return fail('Unsupported message type.');

  const text = optionalString(body.messageText);
  if (text && text.length > MAX_TEXT_CHARS) {
    return fail(`Message is too long (max ${MAX_TEXT_CHARS} characters).`);
  }
  if (messageType === 'text') {
    if (!text) return fail('A text message needs something to say.');
  }

  const mediaUrl = optionalString(body.mediaUrl);
  const needsMedia = messageType === 'image' || messageType === 'video' || messageType === 'file' || messageType === 'voice';
  if (needsMedia) {
    if (!mediaUrl) return fail('That attachment never reached the server.');
    if (mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:')) {
      return fail('Attachments must be uploaded to the server before sending.');
    }
    if (!isVpsMediaUrl(mediaUrl, ctx.chatId)) {
      return fail('Attachment is not stored on this server.');
    }
  } else if (mediaUrl && !isVpsMediaUrl(mediaUrl, ctx.chatId)) {
    return fail('Attachment is not stored on this server.');
  }

  const productId = optionalString(body.productId);
  const orderId = optionalString(body.orderId);
  if (messageType === 'product') {
    if (!productId || !ENTITY_ID.test(productId)) return fail('Invalid product.');
  } else if (messageType === 'order') {
    if (!orderId || !ENTITY_ID.test(orderId)) return fail('Invalid order.');
  }
  if (productId && !ENTITY_ID.test(productId)) return fail('Invalid product.');
  if (orderId && !ENTITY_ID.test(orderId)) return fail('Invalid order.');

  const mediaMetadata = needsMedia ? normalizeMetadata(body.mediaMetadata) : null;

  const value: ChatMessageInput = {
    clientMsgId,
    messageType,
    ...(text ? { messageText: text } : {}),
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(mediaMetadata ? { mediaMetadata } : {}),
    ...(productId ? { productId } : {}),
    ...(orderId ? { orderId } : {}),
  };

  return { ok: true, value, preview: buildPreview(messageType, text) };
}

/** Guard for the `participantId` of "open a conversation with …". */
export function isValidUid(uid: unknown): uid is string {
  return typeof uid === 'string' && UID.test(uid);
}
