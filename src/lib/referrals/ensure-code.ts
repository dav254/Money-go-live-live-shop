import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { normaliseReferralCode, referralCodeFor, referralNameSlug } from './referral-code';

/**
 * REFERRAL CODE DIRECTORY — turns code lookup from O(users) into O(1).
 *
 * ## The problem this solves
 *
 * Resolving an invite code originally meant reading every `userProfiles`
 * document and deriving each one's code until one matched. That is correct but
 * linear in the size of the user base, and it runs on every single signup that
 * arrives with a `?ref=` — so the busier the marketplace gets, the slower
 * signup gets, and it degrades exactly when it matters most.
 *
 * ## The fix
 *
 * A `referralCodes` collection keyed by the code itself:
 *
 *     referralCodes/{CODE} = { uid, createdAt }
 *
 * One point read resolves a code. The code is the document id, so the lookup
 * needs no query, no index and no scan — and Firestore serves it from the same
 * region as the profile write that follows.
 *
 * ## Why a directory is needed at all, now that codes are names
 *
 * A name is not unique. Two people can both be "David Chege", and a slug
 * derived from a name cannot be computed by a pure function of the uid the way
 * the legacy token could — someone else may already hold `david-chege`. So
 * uniqueness is resolved here, by trying the slug and then `-2`, `-3`, until an
 * unclaimed document id is found. That is a read-then-write, so it happens on
 * the server, once, and the winner is written to the profile as
 * `referralSlug` so every later read of the user's own code is free.
 *
 * ## Legacy codes still resolve
 *
 * `ensureReferralCode` indexes BOTH the name slug and the legacy six-character
 * token against the same uid, and `resolveReferralCode` looks the slug up
 * first and the uppercased token second. Links shared before this change keep
 * crediting the right person.
 */

/** The collection that backs the code directory. */
const CODES = 'referralCodes';

/** How many `-2`, `-3`… variants to try before giving up on a slug. */
const MAX_SLUG_ATTEMPTS = 25;

/**
 * Writes (or refreshes) a user's code in the directory.
 *
 * `name` is whatever the person is called — profile full name, display name or
 * shop name. It is optional: with no usable name the user falls back to the
 * legacy token, exactly as before, so this never fails to produce a code.
 *
 * Idempotent, so it is safe to call on every profile read, on signup, or from
 * a backfill. Returns the code to show and share, or '' when there is no uid.
 */
export async function ensureReferralCode(uid: string, name?: string | null): Promise<string> {
  if (!uid) return '';

  // Always index the legacy token: it is what old links carry.
  const legacy = referralCodeFor(uid);

  let slug = '';
  try {
    const existing = await db.collection('userProfiles').doc(uid).get();
    const stored = (existing.data() as { referralSlug?: string } | undefined)?.referralSlug;
    if (stored) slug = normaliseReferralCode(stored);

    // Claim a slug, or re-use the one already on the profile.
    if (slug) {
      const held = await db.collection(CODES).doc(slug).get();
      if (!held.exists || (held.data() as { uid?: string })?.uid === uid) {
        // ours, or free — keep it
      } else {
        slug = '';
      }
    }

    if (!slug) {
      const base = referralNameSlug(name, uid);
      for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
        const candidate = attempt === 1 ? base : `${base}-${attempt}`;
        const snap = await db.collection(CODES).doc(candidate).get();
        if (!snap.exists || (snap.data() as { uid?: string })?.uid === uid) {
          slug = candidate;
          break;
        }
      }
    }

    if (slug) {
      await db.collection(CODES).doc(slug).set(
        { uid, name: name || '', updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      await db.collection('userProfiles').doc(uid).set(
        { referralSlug: slug },
        { merge: true },
      );
    }
  } catch (error) {
    // A missing directory entry must never fail a signup. `resolveReferralCode`
    // degrades to a null referrer rather than throwing.
    console.error('[referrals] could not index code:', error);
  }

  try {
    await db.collection(CODES).doc(legacy).set(
      { uid, legacy: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    console.error('[referrals] could not index legacy code:', error);
  }

  return slug || legacy;
}

/**
 * Resolves an invite code to the uid that owns it.
 *
 * Tries the normalised (lowercase) slug first, then the uppercase legacy
 * token, because document ids are case-sensitive and every link issued before
 * the name-slug change carries an uppercase token. Both point at the same
 * `referralCodes` collection, so this is two point reads in the worst case.
 *
 * Returns null for an unknown code so the caller can tell "nobody owns this"
 * apart from "we could not check".
 */
export async function resolveReferralCode(code: string): Promise<string | null> {
  const normalised = normaliseReferralCode(code);
  if (!normalised) return null;

  // Dedupe: a purely numeric slug has no distinct uppercase form.
  const candidates = Array.from(new Set([normalised, normalised.toUpperCase()]));

  for (const candidate of candidates) {
    try {
      const snap = await db.collection(CODES).doc(candidate).get();
      if (snap.exists) {
        const uid = (snap.data() as { uid?: string })?.uid;
        if (uid) return uid;
      }
    } catch (error) {
      console.error('[referrals] code lookup failed:', error);
    }
  }

  return null;
}

/**
 * Backfills the directory for every existing user.
 *
 * Run once after deploying. Safe to re-run: it is an idempotent `set`, so a
 * second pass costs writes but changes nothing — and because the slug already
 * written to a profile is re-used, a second pass does not churn `david-chege`
 * into `david-chege-2`.
 *
 * Paged so a large user base does not produce a single enormous read.
 */
export async function backfillReferralCodes(
  onProgress?: (done: number) => void,
): Promise<{ indexed: number; failed: number }> {
  const PAGE = 400;
  let indexed = 0;
  let failed = 0;
  let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let page = db.collection('userProfiles').limit(PAGE);
    if (last) page = page.startAfter(last);

    const snap = await page.get();
    if (snap.empty) break;

    for (const userDoc of snap.docs) {
      const data = userDoc.data() as { fullName?: string; name?: string };
      try {
        await ensureReferralCode(userDoc.id, data?.fullName || data?.name || '');
        indexed++;
      } catch (error) {
        failed++;
        console.error('[referrals] backfill failed for', userDoc.id, error);
      }
    }

    onProgress?.(indexed);
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }

  return { indexed, failed };
}
