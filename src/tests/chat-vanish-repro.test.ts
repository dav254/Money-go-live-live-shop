/**
 * Live-repro trace: "my messages vanished" (messaging inbox bug family).
 * Run: npx tsx --test src/tests/chat-vanish-repro.test.ts
 *
 * WHY THIS IS SOURCE-ANCHORED, NOT EMULATOR-BASED
 * -----------------------------------------------
 * The Firestore emulator needs Java (absent in this sandbox) and the local
 * service-account is revoked, so a two-account end-to-end run against prod is
 * impossible here. This suite instead machine-checks the *repro premises*
 * against the real client source and rules text, and executes the exact state
 * transition the server applies — so each repro step is pinned to file+line
 * and any change to a premise (fix or regression) fails loudly.
 *
 * PRODUCTION (HEAD) VANISH REPROS — guards asserted below, all three fixed in
 * the working tree, still live in prod until the next deploy:
 *
 *  V1 · seller inbox shows NOTHING ("the buyer never messaged me")
 *       seller-messages.tsx fetched profiles with a batched
 *       `where('id','in',chunk)` query. Rules allow `get` on userProfiles but
 *       restrict `list` to self/referrer/admin, so the read was denied the
 *       moment a seller read a buyer's profile. The rejection was uncaught →
 *       it aborted the whole `onSnapshot` callback → no chat was ever set.
 *       Fix in tree: one `getDoc` per id (public `get`) + `.catch(() => null)`.
 *
 *  V2 · inbox stuck on "SYNCING…" forever ("my messages vanished")
 *       chat-system.tsx awaited `Promise.all(participantPromises)` with no
 *       catch. One rejected chunk (rules denial or network blip) escaped the
 *       await, so `setIsLoading(false)` below never ran and the loader never
 *       cleared. Fix in tree: try/catch with a cached-profiles fallback.
 *
 *  V3 · rows silently missing from the list
 *       conversation-list.tsx did `if (!otherParticipant) return null;` — any
 *       chat whose peer profile had not resolved (V1/V2 can both cause that)
 *       rendered as nothing at all. Fix in tree: optional chaining + fallback.
 *
 * LIVE REPRO (NOT YET FIXED) — the shared `deletedFor` clobber:
 *
 *  Every surface hides a conversation with a *per-user* flag
 *  (`deletedFor: arrayUnion(uid)`), and every list filter is per-user
 *  (`!deletedFor.includes(uid)`). But every send (and reopen) rewrites the
 *  SHARED array wholesale with `deletedFor: []` — so a message from the other
 *  participant erases *your* hide. Verified steps:
 *
 *   1. Seller deletes the conversation → chats/{id}.deletedFor = [seller].
 *      Seller's list filter excludes it. Correct.
 *   2. Buyer sends a message → buyer client writes chats/{id}
 *      { deletedFor: [] } (buyer-messages.tsx send()).
 *   3. Firestore applies the update wholesale (the chats rule permits any
 *      participant to `update`, so it is not denied) → seller's uid is gone.
 *   4. Seller's `onSnapshot` fires (the list query filters only on
 *      participantIds, never on deletedFor) → the filter no longer excludes
 *      the chat → the deleted conversation REAPPEARS with a fresh badge.
 *
 *   Manual two-account check (prod or preview):
 *     A: Messages → open chat → ⋯ → Delete  (row leaves A's inbox)
 *     B: send "hello"
 *     A: inbox — the deleted chat is back.
 *
 *   The missing fix is a per-user removal (`arrayRemove(myUid)`) instead of a
 *   wholesale `[]` reset; this suite asserts no surface uses arrayRemove yet,
 *   so a future fix flips that test and forces the simulation to be updated.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
/** Strip block + full-line comments: assertions must never match doc text. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...p: string[]) => codeOnly(readFileSync(join(ROOT, ...p), 'utf8'));

const SELLER_MESSAGES = read('src', 'components', 'app', 'seller', 'messages', 'seller-messages.tsx');
const SELLER_THREAD = read('src', 'components', 'app', 'seller', 'messages', 'thread.tsx');
const BUYER_MESSAGES = read('src', 'components', 'app', 'buyer', 'messages', 'buyer-messages.tsx');
const CHAT_SYSTEM = read('src', 'components', 'messages', 'chat-system.tsx');
const CHAT_WINDOW = read('src', 'components', 'messages', 'chat-window.tsx');
const CONVERSATION_LIST = read('src', 'components', 'messages', 'conversation-list.tsx');
const RULES = read('src', 'firestore.rules');

const ALL_SURFACES = {
  'chat-window.tsx (website two-pane)': CHAT_WINDOW,
  'chat-system.tsx (website chat system)': CHAT_SYSTEM,
  'seller thread.tsx (seller app)': SELLER_THREAD,
  'buyer-messages.tsx (buyer app)': BUYER_MESSAGES,
};

describe('vanish V1: seller inbox emptied by a denied batched profile query', () => {
  it('seller-messages fetches profiles with per-id getDoc (public `get`), never a batched `in` list query', () => {
    assert.doesNotMatch(
      SELLER_MESSAGES,
      /where\(\s*'id',\s*'in'/,
      'V1 regression: a batched where(id,in) query on userProfiles is denied by rules for non-self reads',
    );
    assert.match(
      SELLER_MESSAGES,
      /getDoc\(\s*doc\(\s*firestore,\s*'userProfiles',\s*id\s*\)/,
      'expected one getDoc(userProfiles/{id}) per participant',
    );
    assert.match(
      SELLER_MESSAGES,
      /\.catch\(\s*\(\)\s*=>\s*null/,
      'a rejected profile read must be caught, or it aborts the onSnapshot callback and empties the inbox',
    );
  });
});

describe('vanish V2: inbox stuck on the SYNCING loader', () => {
  it('chat-system guards the participant Promise.all so a rejection cannot skip setIsLoading(false)', () => {
    assert.match(
      CHAT_SYSTEM,
      /let fetchedParticipants:\s*UserProfile\[\]\s*=\s*\[\];/,
      'expected an initialised fallback before the await',
    );
    assert.match(
      CHAT_SYSTEM,
      /try\s*\{[\s\S]*?participantSnapshots[\s\S]*?\}\s*catch\s*\(error\)/,
      'the participant lookup must be inside try/catch',
    );
    assert.match(CHAT_SYSTEM, /setIsLoading\(false\)/);
  });
});

describe('vanish V3: rows rendered as nothing when the peer profile is unresolved', () => {
  it('conversation-list no longer drops chats with a missing otherParticipant', () => {
    assert.doesNotMatch(
      CONVERSATION_LIST,
      /if\s*\(\s*!otherParticipant\s*\)\s*return null/,
      'V3 regression: unresolved peer profiles must render a placeholder, not vanish the row',
    );
    assert.match(CONVERSATION_LIST, /otherParticipant\?\.fullName/);
  });
});

describe('live repro: the shared deletedFor clobber', () => {
  it('premise — every send rewrites the shared array wholesale with deletedFor: []', () => {
    for (const [name, src] of Object.entries(ALL_SURFACES)) {
      assert.match(
        src,
        /deletedFor:\s*\[\]/,
        `${name} no longer resets deletedFor — update the repro simulation below if this was a fix`,
      );
    }
  });

  it('premise — hiding is per-user (arrayUnion) and every list filter is per-user (includes)', () => {
    // Hide sites: both surfaces that expose "Delete conversation".
    assert.match(CHAT_WINDOW, /deletedFor:\s*arrayUnion\(/);
    assert.match(SELLER_THREAD, /deletedFor:\s*arrayUnion\(/);
    // List filters: identical per-user predicate on all three list surfaces.
    assert.match(SELLER_MESSAGES, /!\(chat\.deletedFor\s*\?\?\s*\[\]\)\.includes\(user\.uid\)/);
    assert.match(BUYER_MESSAGES, /!\(c\.deletedFor\s*\|\|\s*\[\]\)\.includes\(user\?\.uid\s*\?\?\s*''\)/);
    assert.match(CHAT_SYSTEM, /!chat\.deletedFor\?\.includes\(user\.uid\)/);
  });

  it('premise — no surface removes only its own uid (the missing fix)', () => {
    for (const [name, src] of Object.entries(ALL_SURFACES)) {
      assert.doesNotMatch(
        src,
        /arrayRemove/,
        `${name} now uses arrayRemove — the clobber is fixed: re-verify the simulation below`,
      );
    }
  });

  it('premise — the rules let any participant update the chat doc, so the clobber is not denied server-side', () => {
    const chatsBlock = RULES.match(/match\s+\/chats\/\{chatId\}\s*\{([\s\S]*?)match\s+\/messages/);
    assert.ok(chatsBlock, 'chats match block missing from src/firestore.rules');
    assert.match(
      chatsBlock[1],
      /allow list, read, update: if isSignedIn\(\) && \(request\.auth\.uid in resource\.data\.participantIds \|\| isAdmin\(\)\);/,
    );
  });

  it('REPRO: seller deletes the chat, buyer sends, seller\'s hidden chat becomes visible again', () => {
    // The chat document as it exists after the seller taps "Delete".
    type ChatDoc = { participantIds: string[]; deletedFor: string[]; lastMessage?: string };
    const SELLER = 'seller-uid';
    const BUYER = 'buyer-uid';

    // Same predicate the seller list runs (seller-messages.tsx).
    const sellerSees = (c: ChatDoc) => !(c.deletedFor ?? []).includes(SELLER);

    let chat: ChatDoc = { participantIds: [SELLER, BUYER], deletedFor: [] };

    // Step 1 — seller hides it: thread.tsx removeConversation() writes
    // `deletedFor: arrayUnion(currentUser.uid)`.
    chat = { ...chat, deletedFor: [...new Set([...chat.deletedFor, SELLER])] };
    assert.equal(sellerSees(chat), false, 'step 1: chat must leave the seller inbox');

    // Step 2 — buyer sends: buyer-messages.tsx send() writes the whole chat
    // update `{ lastMessage, lastMessageTimestamp, deletedFor: [] }`.
    const buyerSendPayload: Partial<ChatDoc> = { deletedFor: [] };
    chat = { ...chat, ...buyerSendPayload };

    // Step 3 — server applies the payload wholesale (participant update rule
    // allows it), then the seller's onSnapshot re-runs the filter.
    assert.equal(
      sellerSees(chat),
      true,
      'step 3 REPRO: the seller\'s deleted conversation is visible again — this is the live bug',
    );
    assert.deepEqual(chat.deletedFor, [], 'the buyer\'s send erased the seller\'s hide flag');
  });
});
