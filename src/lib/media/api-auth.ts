import { auth } from '@/firebase/server';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Verifies a Firebase ID token from an API request.
 * Accepts `Authorization: Bearer <idToken>` (used by the upload client).
 * Returns the decoded uid, or null when unauthenticated.
 *
 * It must go through `@/firebase/server`'s `auth`, never a bare `getAuth()`
 * from `firebase-admin/auth`: a bare call resolves the DEFAULT app, which
 * only exists once something has imported `@/firebase/server`. This module is
 * imported by the upload route BEFORE anything else in that route's graph has
 * done that (the engine only pulls it in lazily, later), so the bare call
 * threw `app/no-app`, the catch turned it into `null`, and every upload —
 * photo or video — came back `401 Unauthorized` no matter how valid the token
 * was. Importing the app's own auth instance makes initialization a
 * guaranteed side effect of importing this helper.
 */
export async function verifyRequestUser(request: Request): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  /*
   * Codes that mean "this token is genuinely not acceptable" — expired,
   * revoked, malformed, wrong project. Retrying those is pointless: only the
   * client (with a fresh token) can change the outcome.
   */
  const FINAL_CODES = new Set([
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/argument-error',
    'auth/invalid-id-token',
    'auth/invalid-argument',
    'auth/project-mismatch',
  ]);

  let refusal = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid };
    } catch (error) {
      const err = error as { code?: string; message?: string };
      refusal = `${err?.code || 'unknown-code'} - ${(err?.message || 'no message').slice(0, 300)}`;
      /*
       * Transient failures — most commonly `auth/internal-error` while the
       * admin SDK fetches Google's public certs, which fails whenever the
       * server is under load or mid-restart — used to be answered with
       * "Unauthorized", so a valid seller saw their video upload refused for
       * no reason. Retry those a couple of times before giving up.
       */
      if (FINAL_CODES.has(err?.code || '') || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }

  // The token itself is never logged — only why it was refused. Without
  // this line every auth failure in the media routes looked identical from
  // outside ("Unauthorized"), which is what made the upload failure
  // impossible to diagnose: a missing admin app, a project mismatch and an
  // expired token all report the same thing to the client.
  console.error('[media/auth] id token rejected:', refusal);
  return null;
}

/**
 * Mint a server-side Firebase ID token for `uid`.
 *
 * Only used by the local end-to-end upload / video smoke scripts so they can
 * replay a real browser upload path without the web client: the script reads
 * the same auth module the route does, and the server verifies through the same
 * `auth.verifyIdToken` it trusts from the app. Nowhere else in the app calls
 * this — real clients mint tokens through `firebase/auth`.
 */
export async function mintServerIdToken(uid: string): Promise<string> {
  return auth.createCustomToken(uid, { admin: 'media-e2e-probe' });
}
