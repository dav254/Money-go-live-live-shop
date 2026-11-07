'use client';

/**
 * CLIENT AUTH SEAM — PocketBase first, through our own API.
 *
 * The login and signup screens used to call `signInWithEmailAndPassword` /
 * `createUserWithEmailAndPassword` directly, which sent the password to
 * Google. They now call `/api/auth/v2/*`, where PocketBase verifies and stores
 * the credential. On success the endpoint returns a Firebase **custom token**
 * for the same uid, and the client signs in with it — so `useUser()`,
 * Firestore rules and every existing screen keep working unchanged.
 *
 * Two deliberate behaviours:
 *
 *   • `identity_unconfigured` (this deployment has no PocketBase configured) is
 *     the ONLY case that falls back to a direct Firebase sign-in. A runtime
 *     failure of the identity store is reported to the user instead, because
 *     quietly creating a Firebase-only account would split identities again.
 *   • errors are thrown with Firebase-style codes (`auth/email-already-in-use`,
 *     …) so the existing error mapping in the auth screens stays correct.
 */

import {
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth';

interface SessionPayload {
  uid: string;
  email: string;
  customToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  migrated?: boolean;
}

interface ApiResponse {
  ok?: boolean;
  code?: string;
  message?: string;
  session?: SessionPayload;
}

/** API failure code → the Firebase code the auth screens already translate. */
const CODE_MAP: Record<string, string> = {
  email_in_use: 'auth/email-already-in-use',
  invalid_credentials: 'auth/invalid-credential',
  account_suspended: 'auth/user-disabled',
  rate_limited: 'auth/too-many-requests',
  invalid_input: 'auth/invalid-email',
  // The identity store being down is NOT a network problem on the visitor's
  // side; it gets its own code so the screen can show the server's sentence
  // instead of blaming their connection.
  identity_unavailable: 'auth/internal-error',
  identity_unconfigured: 'auth/network-request-failed',
};

export class VidnovAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'VidnovAuthError';
    this.code = code;
  }
}

async function postIdentity(path: string, body: Record<string, unknown>): Promise<ApiResponse | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await response.json().catch(() => ({}))) as ApiResponse;
  } catch {
    throw new VidnovAuthError(
      'auth/network-request-failed',
      'Network error. Check your connection and try again.',
    );
  }
}

/** True when the API explicitly says this deployment has no identity store. */
function isUnconfigured(payload: ApiResponse | null): boolean {
  return payload?.ok === false && payload.code === 'identity_unconfigured';
}

function throwApiError(payload: ApiResponse | null): never {
  const code = CODE_MAP[payload?.code ?? ''] ?? 'auth/internal-error';
  const message =
    payload?.message ||
    (code === 'auth/invalid-credential'
      ? 'The email or password you entered is incorrect.'
      : 'Sign-in failed. Please try again.');
  throw new VidnovAuthError(code, message);
}

export async function signInWithVidnov(
  auth: Auth,
  email: string,
  password: string,
): Promise<UserCredential> {
  const payload = await postIdentity('/api/auth/v2/login', {
    email: email.trim(),
    password,
  });

  if (payload?.ok && payload.session?.customToken) {
    return signInWithCustomToken(auth, payload.session.customToken);
  }

  if (isUnconfigured(payload)) {
    return signInWithEmailAndPassword(auth, email.trim(), password);
  }

  return throwApiError(payload);
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
  phone?: string;
  role?: string;
}

export async function registerWithVidnov(
  auth: Auth,
  input: RegisterInput,
): Promise<UserCredential> {
  const payload = await postIdentity('/api/auth/v2/register', {
    email: input.email.trim(),
    password: input.password,
    fullName: input.fullName,
    username: input.username,
    phone: input.phone,
    role: input.role,
  });

  if (payload?.ok && payload.session?.customToken) {
    return signInWithCustomToken(auth, payload.session.customToken);
  }

  if (isUnconfigured(payload)) {
    return createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  }

  return throwApiError(payload);
}
