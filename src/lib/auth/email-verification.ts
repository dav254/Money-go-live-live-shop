/**
 * Signup email verification — single-use, expiring, hashed-at-rest tokens.
 *
 * Mirrors the established password-reset pattern (`forgot-password` route):
 * the raw token exists only in the emailed link; Firestore stores its hash,
 * the expiry and the single-use markers. The admin SDK is the only writer —
 * the collection is covered by the default-deny catch-all in the security
 * rules and never becomes client-readable.
 *
 * Verification is deliberately NON-BLOCKING: it marks the Firebase account
 * `emailVerified` and sends the post-verification welcome, but nothing in
 * the login path is changed — existing sessions and sign-in behaviour are
 * untouched.
 */

import type { StoreDb } from '@/lib/notifications/email-store';
import { appLink } from '@/lib/notifications/config';
import { generateToken, hashToken } from '@/lib/notifications/server';

export const EMAIL_VERIFICATION_TOKENS = 'emailVerificationTokens';

/** Verification links expire after 24 hours. */
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Issues a fresh verification token for `uid`, invalidating any previous
 * unused token (bounded read), and returns the absolute link to email —
 * or `null` when the store could not be written (caller decides whether to
 * fall back; a token failure must never fail signup).
 */
export async function issueEmailVerification(
  db: StoreDb,
  uid: string,
  email: string,
): Promise<string | null> {
  if (!uid || !email) return null;

  // Invalidate previous outstanding tokens — at most 10 are inspected.
  try {
    const old = await db.collection(EMAIL_VERIFICATION_TOKENS).where('uid', '==', uid).limit(10).get();
    for (const doc of old.docs) {
      if (!doc.data().usedAt) await doc.ref.delete();
    }
  } catch {
    // Best-effort cleanup: issuing the new token is what matters.
  }

  const raw = generateToken();
  const now = Date.now();
  try {
    await db.collection(EMAIL_VERIFICATION_TOKENS).add({
      uid,
      email,
      tokenHash: hashToken(raw),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + VERIFICATION_TTL_MS).toISOString(),
      usedAt: null,
      attempts: 0,
    });
  } catch {
    return null;
  }

  return `${appLink('/verify-email')}?oobCode=${raw}&email=${encodeURIComponent(email)}`;
}
