/**
 * MESSAGE SECTION → VPS MIGRATION.
 *
 * The chat feature moved off Firebase: conversations and messages are written
 * by `/api/chat/*` into PocketBase on the VPS, and every attachment (photo,
 * video, voice note, file) is a file this server stores under
 * `chats/<chatId>/`. This suite pins the contract the migration exists to
 * guarantee, in three layers:
 *
 *  1. BEHAVIOUR — `src/lib/chat/validate.ts` is pure, so the payload rules are
 *     executed for real (an inline `data:` URL, a foreign host, a traversal
 *     attempt, an oversized body, an unknown type are all refused).
 *  2. STORE — no Firebase import anywhere in the VPS store: a missing PocketBase
 *     configuration must fail loudly (503) rather than quietly falling back to
 *     Firestore and putting messages back where they came from.
 *  3. SOURCE — the routes verify identity server-side and never take a uid or a
 *     participant list from the body; the surfaces never open a Firestore
 *     listener or write to `chats`; the media engine authorises the chat folder
 *     through the chat store.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import {
  buildPreview,
  isVpsMediaUrl,
  validateMessageInput,
  MAX_TEXT_CHARS,
} from '../lib/chat/validate';

const ROOT = join(__dirname, '..', '..');
/** Strip block + full-line comments: assertions must never match doc text. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...p: string[]) => codeOnly(readFileSync(join(ROOT, ...p), 'utf8'));
const readRaw = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const CHAT_ID = 'a1b2c3d4e5f6';
const SELLER = 'seller_uid_1';
const CTX = { chatId: CHAT_ID, senderId: SELLER };
const OK_ID = 'f'.repeat(32);
const OK_MEDIA = `/api/media/file/chats/${CHAT_ID}/m123.webp`;

const SURFACES: Record<string, string> = {
  'chat-window.tsx': read('src', 'components', 'messages', 'chat-window.tsx'),
  'chat-system.tsx': read('src', 'components', 'messages', 'chat-system.tsx'),
  'seller thread.tsx': read('src', 'components', 'app', 'seller', 'messages', 'thread.tsx'),
  'seller-messages.tsx': read('src', 'components', 'app', 'seller', 'messages', 'seller-messages.tsx'),
  'buyer-messages.tsx': read('src', 'components', 'app', 'buyer', 'messages', 'buyer-messages.tsx'),
};

const ROUTES = [
  read('src', 'app', 'api', 'chat', 'route.ts'),
  read('src', 'app', 'api', 'chat', '[chatId]', 'route.ts'),
  read('src', 'app', 'api', 'chat', '[chatId]', 'messages', 'route.ts'),
  read('src', 'app', 'api', 'chat', '[chatId]', 'messages', '[messageId]', 'route.ts'),
];

/* ------------------------------------------------------------------ 1. payload rules */

describe('chat payload validation (executed, not asserted from source)', () => {
  it('accepts a message whose attachment this server stored in this chat', () => {
    const result = validateMessageInput(
      {
        clientMsgId: OK_ID,
        messageType: 'image',
        mediaUrl: OK_MEDIA,
        mediaMetadata: { name: 'photo.jpg', size: 12_345, type: 'image/jpeg' },
      },
      CTX,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.preview, 'Sent a photo');
  });

  it('refuses an inline data: URL — attachments must live on the VPS', () => {
    const result = validateMessageInput(
      { clientMsgId: OK_ID, messageType: 'image', mediaUrl: 'data:image/jpeg;base64,AAAA' },
      CTX,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /uploaded to the server/i);
  });

  it('refuses a blob: URL (the buyer app used to send these — they only work on the sender device)', () => {
    const result = validateMessageInput(
      { clientMsgId: OK_ID, messageType: 'image', mediaUrl: 'blob:https://vidnov.com/xyz' },
      CTX,
    );
    assert.equal(result.ok, false);
  });

  it('refuses an attachment stored for a DIFFERENT conversation', () => {
    const result = validateMessageInput(
      { clientMsgId: OK_ID, messageType: 'file', mediaUrl: `/api/media/file/chats/otherchat/x.pdf` },
      CTX,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /not stored on this server/i);
  });

  it('refuses an external host and a path traversal', () => {
    assert.equal(isVpsMediaUrl(`https://evil.example/x.webp`, CHAT_ID), false);
    assert.equal(isVpsMediaUrl(`/api/media/file/chats/${CHAT_ID}/../secrets.txt`, CHAT_ID), false);
    assert.equal(isVpsMediaUrl(`/api/media/serve/m123`, CHAT_ID), false);
    assert.equal(isVpsMediaUrl('', CHAT_ID), false);
  });

  it('requires text for a text message and caps its length', () => {
    assert.equal(validateMessageInput({ clientMsgId: OK_ID, messageType: 'text' }, CTX).ok, false);
    const tooLong = validateMessageInput(
      { clientMsgId: OK_ID, messageType: 'text', messageText: 'x'.repeat(MAX_TEXT_CHARS + 1) },
      CTX,
    );
    assert.equal(tooLong.ok, false);
    const ok = validateMessageInput(
      { clientMsgId: OK_ID, messageType: 'text', messageText: 'hello' },
      CTX,
    );
    assert.equal(ok.ok, true);
  });

  it('refuses an unknown message type and a malformed client id', () => {
    assert.equal(
      validateMessageInput({ clientMsgId: OK_ID, messageType: 'sticker' }, CTX).ok,
      false,
    );
    assert.equal(
      validateMessageInput({ clientMsgId: 'abc', messageType: 'text', messageText: 'hi' }, CTX).ok,
      false,
    );
  });

  it('requires a real product id for a shared product, and validates it', () => {
    assert.equal(
      validateMessageInput({ clientMsgId: OK_ID, messageType: 'product' }, CTX).ok,
      false,
    );
    assert.equal(
      validateMessageInput(
        { clientMsgId: OK_ID, messageType: 'product', productId: 'prod; drop table' },
        CTX,
      ).ok,
      false,
    );
    assert.equal(
      validateMessageInput({ clientMsgId: OK_ID, messageType: 'product', productId: 'prod_1' }, CTX)
        .ok,
      true,
    );
  });

  it('derives the inbox preview from the message — the client never supplies it', () => {
    assert.equal(buildPreview('text', 'a'.repeat(500)).length, 140);
    assert.equal(buildPreview('voice'), 'Voice note');
    assert.equal(buildPreview('image'), 'Sent a photo');
    assert.equal(buildPreview('video'), 'Sent a video');
    assert.equal(buildPreview('product'), 'Shared a product');
    assert.equal(buildPreview('order'), 'Shared an order');
    assert.equal(buildPreview('file'), 'Sent a file');
  });

  it('rejects a payload that is not an object', () => {
    assert.equal(validateMessageInput(null, CTX).ok, false);
    assert.equal(validateMessageInput('hello', CTX).ok, false);
    assert.equal(validateMessageInput([], CTX).ok, false);
  });
});

/* ------------------------------------------------------------------ 2. store */

describe('VPS chat store — no Firebase fallback', () => {
  it('store.ts never imports Firebase (a missing PocketBase must fail loudly, not fall back)', () => {
    const store = read('src', 'lib', 'chat', 'store.ts');
    assert.doesNotMatch(
      store,
      /@\/firebase|firebase-admin|firebase\/firestore/,
      'the chat store must not write to Firebase when PocketBase is off',
    );
    assert.match(store, /MessagingUnavailableError/);
    assert.match(store, /pocketBaseEnabled\(\)/);
  });

  it('every chat API route derives the caller from a verified token', () => {
    for (const route of ROUTES) {
      assert.match(
        route,
        /verifyUserContext|verifyUserUid/,
        'a /api/chat route must verify the Bearer token before doing anything',
      );
      assert.match(route, /export const runtime = 'nodejs'/);
    }
  });

  it('no route trusts a uid, participant list or counter from the request body', () => {
    for (const route of ROUTES) {
      assert.doesNotMatch(
        route,
        /body\?\.uid|body\.uid|participantIds\s*:|unreadCounts\?\.|sellerId/,
        'identity and counters are decided server-side, never read from the body',
      );
    }
  });

  it('the send route validates the payload before anything is written', () => {
    const sendRoute = ROUTES[2];
    assert.match(sendRoute, /validateMessageInput\(body, \{\s*chatId, senderId: user\.uid\s*\}\)/);
    assert.match(sendRoute, /MAX_REQUEST_BYTES/);
    assert.match(sendRoute, /isChatParticipant/);
  });

  it('sending is idempotent: the client-minted id becomes the record id', () => {
    const store = read('src', 'lib', 'chat', 'store.ts');
    assert.match(store, /id: input\.clientMsgId/);
    assert.match(store, /duplicate/);
  });
});

/* ------------------------------------------------------------------ 3. surfaces */

describe('message surfaces — off Firestore entirely', () => {
  it('no surface opens a Firestore listener or writes to `chats`', () => {
    for (const [name, src] of Object.entries(SURFACES)) {
      assert.doesNotMatch(src, /\bonSnapshot\(/, `${name} still subscribes to Firestore`);
      assert.doesNotMatch(
        src,
        /collection\(\s*firestore\s*,\s*'chats'/,
        `${name} still queries the Firestore chats collection`,
      );
      assert.doesNotMatch(
        src,
        /\b(addDoc|updateDoc|deleteDoc|setDoc|writeBatch)\(/,
        `${name} still writes documents directly`,
      );
    }
  });

  it('every surface loads conversations and messages through the VPS hooks', () => {
    assert.match(SURFACES['chat-window.tsx'], /useMessages\(/);
    assert.match(SURFACES['seller thread.tsx'], /useMessages\(/);
    assert.match(SURFACE_KEY(SURFACES, 'buyer'), /useMessages\(/);
    assert.match(SURFACES['chat-system.tsx'], /useChats\(/);
    assert.match(SURFACES['seller-messages.tsx'], /useChats\(/);
    assert.match(SURFACE_KEY(SURFACES, 'buyer'), /useChats\(/);
  });

  it('attachments are uploaded to the VPS chats folder — no embedded bytes in a message', () => {
    for (const [name, src] of Object.entries(SURFACES)) {
      assert.doesNotMatch(
        src,
        /blobToDataUrl|compressImageForChat|MAX_CHAT_EMBED_BYTES|createObjectURL/,
        `${name} still embeds attachment bytes in the message record`,
      );
    }
    assert.match(SURFACES['chat-window.tsx'], /folder: `chats\/\$\{chat\.id\}`/);
    assert.match(SURFACES['seller thread.tsx'], /folder: `chats\/\$\{chat\.id\}`/);
    assert.match(SURFACE_KEY(SURFACES, 'buyer'), /folder: `chats\/\$\{chat\.id\}`/);
  });

  it('the upload handle is awaited as a promise (awaiting the handle itself always reported Upload failed)', () => {
    for (const [name, src] of Object.entries(SURFACES)) {
      const calls = (src.match(/uploadMedia\(/g) ?? []).length;
      const awaited = (src.match(/\)\.promise/g) ?? []).length;
      if (calls === 0) continue;
      assert.equal(
        calls,
        awaited,
        `${name}: ${calls} uploadMedia call(s) but only ${awaited} awaited as .promise — ` +
          'awaiting the UploadHandle itself resolves instantly with no url, so the send reports "Upload failed"',
      );
    }
  });

  it('the device-embed helper this migration removed is gone', () => {
    assert.equal(
      existsSync(join(ROOT, 'src', 'lib', 'chat', 'device-media.ts')),
      false,
      'src/lib/chat/device-media.ts describes the removed Firebase embed path — delete it',
    );
  });
});

/* ------------------------------------------------------------------ 4. media ownership */

describe('chat media is authorised through the chat store, not Firestore', () => {
  it('both folder resolvers ask the VPS chat store for membership', () => {
    for (const file of ['engine.ts', 'service.ts']) {
      const src = read('src', 'lib', 'media', file);
      const chatBlock = src.slice(src.indexOf("root === 'chats'"), src.indexOf("root === 'chats'") + 600);
      assert.match(chatBlock, /isChatParticipant/, `${file} does not use the chat store`);
      assert.doesNotMatch(chatBlock, /firebase/, `${file} still checks chat membership in Firestore`);
    }
  });

  it('the upload route keeps chat media on this server disk', () => {
    // Doc text (stripped by `codeOnly`) is the only place the folder contract
    // is spelled out, so this one reads the raw file.
    const src = readRaw('src', 'app', 'api', 'media', 'upload', 'route.ts');
    assert.match(src, /chats\/<id>/);
    assert.match(src, /local adapter, no third-party object store/);
    assert.doesNotMatch(src, /firebase\/storage|storage\.bucket/);
  });
});

/** Look up a surface by a stable substring of its name. */
function SURFACE_KEY(surfaces: Record<string, string>, needle: string): string {
  const entry = Object.entries(surfaces).find(([name]) => name.includes(needle));
  if (!entry) throw new Error(`no surface named like "${needle}"`);
  return entry[1];
}
