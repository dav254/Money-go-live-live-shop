/**
 * One-time backfill: Firestore → PocketBase for the MESSAGE section.
 *
 * Copies every `chats` document and its `messages` subcollection to the
 * `chats` / `chat_messages` collections on the local PocketBase instance, so
 * the buyer, seller and website inboxes still show their history after the
 * message section stopped reading Firestore.
 *
 * Two things it does beyond a straight copy:
 *
 *  1. **Attachments are unpacked onto the VPS disk.** The old client embedded
 *     photos and voice notes as `data:` URLs inside the message document.
 *     Those bytes are decoded and pushed through the normal media engine into
 *     `chats/<chatId>/`, and the message is rewritten to the file's URL on
 *     this server — so no conversation payload stays inline, and a thread
 *     with twenty photos does not become a multi-megabyte poll response.
 *     If a single file cannot be processed, the message is still copied
 *     (without the inline bytes) rather than dropped.
 *
 *  2. **Conversation rows are keyed by their original Firestore id**, so a
 *     second run skips everything it already moved and resumes where it
 *     stopped. Message rows use their own Firestore id the same way.
 *
 * Usage (from the project root, with env loaded):
 *   npx -y tsx scripts/migrate-chats.ts
 *
 * Add `--dry-run` to print what would change without writing anything.
 *
 * Requires POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 * plus Firebase credentials resolving exactly like src/firebase/server.ts
 * (GOOGLE_APPLICATION_CREDENTIALS → FIREBASE_SERVICE_ACCOUNT_JSON →
 * ./service-account.json → ADC). Run it on the VPS, once, after deploying.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensureCollection,
  pbListRecords,
  pbCreateRecord,
  pbRequest,
  getPocketBaseConfig,
  type PbField,
} from '../src/lib/pocketbase/server';
import { CHATS_COLLECTION, MESSAGES_COLLECTION } from '../src/lib/chat/store';
import { intake } from '../src/lib/media/engine';

const DRY_RUN = process.argv.includes('--dry-run');

const CHAT_FIELDS: PbField[] = [
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

function initFirebase() {
  if (getApps().length > 0) return;
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const localPath = path.join(process.cwd(), 'service-account.json');
  if (adcPath && fs.existsSync(adcPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(adcPath, 'utf8'))) });
  } else if (inline) {
    initializeApp({ credential: cert(JSON.parse(inline)) });
  } else if (fs.existsSync(localPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(localPath, 'utf8'))) });
  } else {
    initializeApp(); // ADC fallback
  }
}

/** Firestore Timestamp | string | Date | number → ISO string, or undefined. */
function iso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const withMillis = value as { toMillis?: () => number; toDate?: () => Date };
  if (typeof withMillis.toMillis === 'function') {
    const ms = withMillis.toMillis();
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
  }
  if (typeof withMillis.toDate === 'function') {
    const d = withMillis.toDate();
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

function unreadMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

/** Ids already on the VPS — a re-run skips them and resumes. */
async function existingIds(collection: string): Promise<Set<string>> {
  const done = new Set<string>();
  for (let page = 1; ; page++) {
    const items = await pbListRecords(collection, { fields: 'id', perPage: 500, page });
    for (const r of items) done.add(r.id);
    if (items.length < 500) break;
  }
  return done;
}

/**
 * Move an embedded attachment onto the VPS disk. Returns the URL to store, or
 * null when the bytes could not be processed (the message is copied without
 * them rather than dropped).
 */
async function unpackAttachment(
  dataUrl: string,
  chatId: string,
  senderId: string,
  fileName: string,
): Promise<string | null> {
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const header = dataUrl.slice(0, comma); // data:image/jpeg;base64,...
    const isBase64 = /;base64/i.test(header);
    const mime = (header.slice(5).split(';')[0] || 'application/octet-stream').toLowerCase();
    const body = dataUrl.slice(comma + 1);
    const bytes = isBase64 ? Buffer.from(body, 'base64') : Buffer.from(decodeURIComponent(body));
    if (bytes.length === 0) return null;

    const ext =
      mime.includes('jpeg') || mime.includes('jpg')
        ? 'jpg'
        : mime.includes('png')
          ? 'png'
          : mime.includes('webp')
            ? 'webp'
            : mime.includes('gif')
              ? 'gif'
              : mime.includes('ogg')
                ? 'ogg'
                : mime.includes('mp4')
                  ? 'mp4'
                  : mime.includes('mpeg') || mime.includes('mp3')
                    ? 'mp3'
                    : 'bin';
    const safeName = fileName.replace(/[^\w.-]+/g, '_').slice(0, 80) || `attachment.${ext}`;
    const file = new File([new Uint8Array(bytes)], safeName, { type: mime });

    const result = await intake({ file, userId: senderId, folder: `chats/${chatId}` });
    if (!result.accepted || !result.url) {
      console.warn(`    ! attachment refused (${result.reason ?? 'no url'}) — copied without it`);
      return null;
    }
    return result.url;
  } catch (err) {
    console.warn(`    ! attachment failed (${err instanceof Error ? err.message : 'unknown'})`);
    return null;
  }
}

async function migrate(db: Firestore) {
  const cfg = getPocketBaseConfig();
  if (!cfg) {
    console.error(
      'PocketBase is not configured. Set POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL and ' +
        'POCKETBASE_ADMIN_PASSWORD before running this backfill.',
    );
    process.exit(1);
  }

  if (!DRY_RUN) {
    await ensureCollection(CHATS_COLLECTION, CHAT_FIELDS);
    await ensureCollection(MESSAGES_COLLECTION, MESSAGE_FIELDS);
  }
  const doneChats = await existingIds(CHATS_COLLECTION);
  const doneMessages = await existingIds(MESSAGES_COLLECTION);

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}PocketBase at ${cfg.url} — ${doneChats.size} chats and ` +
      `${doneMessages.size} messages already present.`,
  );

  const stats = { chats: 0, skippedChats: 0, messages: 0, skippedMessages: 0, unpacked: 0, unpackFailed: 0, failed: 0 };

  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q: FirebaseFirestore.Query = db.collection('chats').limit(100);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() as Record<string, unknown>;
      const participants = strArray(data.participantIds);
      if (participants.length < 2) {
        console.warn(`  - ${doc.id}: fewer than two participants, skipped`);
        stats.failed++;
        continue;
      }
      const [a, b] = [...participants].sort();
      const createdAt = iso(data.createdAt) ?? iso(data.lastMessageTimestamp) ?? new Date().toISOString();

      if (doneChats.has(doc.id)) {
        stats.skippedChats++;
      } else if (!DRY_RUN) {
        try {
          await pbCreateRecord(CHATS_COLLECTION, {
            id: doc.id,
            participantA: a,
            participantB: b,
            participantIds: participants,
            lastMessage: str(data.lastMessage).slice(0, 140),
            lastMessageTimestamp: iso(data.lastMessageTimestamp) ?? createdAt,
            deletedFor: strArray(data.deletedFor),
            unreadCounts: unreadMap(data.unreadCounts),
            createdAt,
          });
          stats.chats++;
        } catch (err) {
          console.warn(`  - ${doc.id}: chat write failed (${err instanceof Error ? err.message : 'unknown'})`);
          stats.failed++;
          continue;
        }
      } else {
        stats.chats++;
      }

      // Messages — the conversation row must exist first: the media engine
      // checks membership through the chat store before it will store a file
      // under `chats/<chatId>/`.
      let lastMsg: FirebaseFirestore.QueryDocumentSnapshot | undefined;
      for (;;) {
        let mq: FirebaseFirestore.Query = doc.ref.collection('messages').orderBy('timestamp').limit(300);
        if (lastMsg) mq = mq.startAfter(lastMsg);
        const messages = await mq.get();
        if (messages.empty) break;

        for (const m of messages.docs) {
          if (doneMessages.has(m.id)) {
            stats.skippedMessages++;
            continue;
          }
          const md = m.data() as Record<string, unknown>;
          let mediaUrl = str(md.mediaUrl);
          if (mediaUrl.startsWith('data:')) {
            if (DRY_RUN) {
              stats.unpacked++;
            } else {
              const meta = (md.mediaMetadata ?? {}) as { name?: string };
              const moved = await unpackAttachment(
                mediaUrl,
                doc.id,
                str(md.senderId),
                str(meta.name) || 'attachment',
              );
              if (moved) {
                mediaUrl = moved;
                stats.unpacked++;
              } else {
                mediaUrl = '';
                stats.unpackFailed++;
              }
            }
          }

          if (DRY_RUN) {
            stats.messages++;
            continue;
          }

          try {
            await pbCreateRecord(MESSAGES_COLLECTION, {
              id: m.id,
              chatId: doc.id,
              senderId: str(md.senderId),
              messageType: str(md.messageType) || 'text',
              messageText: str(md.messageText) || str(md.text),
              mediaUrl,
              mediaMetadata: (md.mediaMetadata as Record<string, unknown>) ?? null,
              productId: str(md.productId),
              orderId: str(md.orderId),
              isRead: md.isRead === true,
              readAt: iso(md.readAt) ?? null,
              timestamp: iso(md.timestamp) ?? createdAt,
            });
            stats.messages++;
            doneMessages.add(m.id);
          } catch (err) {
            console.warn(`    ! ${m.id}: message write failed (${err instanceof Error ? err.message : 'unknown'})`);
            stats.failed++;
          }
        }

        lastMsg = messages.docs[messages.docs.length - 1];
        if (messages.size < 300) break;
      }

      console.log(`  ✓ ${doc.id} (${participants.length} participants)`);
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 100) break;
  }

  console.log('\nDone.');
  console.log(`  chats copied:      ${stats.chats} (skipped ${stats.skippedChats})`);
  console.log(`  messages copied:   ${stats.messages} (skipped ${stats.skippedMessages})`);
  console.log(`  attachments moved to VPS disk: ${stats.unpacked}${stats.unpackFailed ? `, failed: ${stats.unpackFailed}` : ''}`);
  if (stats.failed) console.log(`  failed:            ${stats.failed}`);
  if (DRY_RUN) console.log('\nDry run — nothing was written.');
}

initFirebase();
migrate(getFirestore())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });

// Referenced so a future edit that drops bulk-update support fails loudly here
// rather than leaving `pbRequest` imported but unused.
void pbRequest;
