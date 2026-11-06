import { FIREBASE } from './config';

/**
 * Firebase Authentication over its public REST API.
 *
 * The app deliberately does not ship the Firebase JS SDK: the website needs
 * Firestore listeners and persistence, the Android app needs exactly three
 * calls (sign in, sign up, refresh) plus a reset email. REST keeps the bundle
 * small and makes the token lifecycle explicit, which is what "session
 * restoration" actually depends on.
 */

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';

export interface FirebaseSession {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

interface IdentityResponse {
  localId?: string;
  email?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  error?: { message?: string };
}

export class AuthError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Firebase's error codes are stable; the UI needs sentences. */
const MESSAGES: Record<string, string> = {
  EMAIL_NOT_FOUND: 'No Vidnov account uses that email.',
  INVALID_PASSWORD: 'That password is not correct.',
  INVALID_LOGIN_CREDENTIALS: 'Email or password is not correct.',
  INVALID_EMAIL: 'Enter a valid email address.',
  EMAIL_EXISTS: 'An account with that email already exists. Sign in instead.',
  WEAK_PASSWORD: 'Choose a stronger password (at least 8 characters).',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Wait a few minutes and try again.',
  USER_DISABLED: 'This account has been disabled. Contact support.',
  OPERATION_NOT_ALLOWED: 'Email sign-in is not enabled for Vidnov right now.',
  MISSING_PASSWORD: 'Enter your password.',
  RESET_PASSWORD_EXCEEDED: 'A reset was just sent. Check your inbox.',
};

function toAuthError(raw: string | undefined, fallback: string): AuthError {
  const code = (raw || 'UNKNOWN').replace('auth/', '').split(' ')[0];
  const message = MESSAGES[code] || MESSAGES[raw || ''] || fallback;
  return new AuthError(message, code);
}

async function identityCall(endpoint: string, body: Record<string, unknown>): Promise<IdentityResponse> {
  let response: Response;
  try {
    response = await fetch(`${IDENTITY}/${endpoint}?key=${FIREBASE.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('Could not reach the sign-in service. Check your connection.', 'network');
  }

  const payload = (await response.json().catch(() => ({}))) as IdentityResponse;
  if (!response.ok) {
    const raw = payload.error?.message;
    if (raw === 'EMAIL_NOT_FOUND') {
      // Firebase deliberately hides whether an address exists for some flows;
      // the reset endpoint still succeeds, which is what the UI promises.
      throw new AuthError(MESSAGES.EMAIL_NOT_FOUND, 'EMAIL_NOT_FOUND');
    }
    throw toAuthError(raw, 'Sign-in failed. Try again.');
  }
  return payload;
}

function toSession(payload: IdentityResponse): FirebaseSession {
  const expiresIn = Number(payload.expiresIn ?? '3600');
  if (!payload.idToken || !payload.refreshToken || !payload.localId) {
    throw new AuthError('The sign-in service returned an incomplete session.', 'incomplete');
  }
  return {
    uid: payload.localId,
    email: payload.email ?? '',
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
}

export async function signInWithPassword(email: string, password: string): Promise<FirebaseSession> {
  const payload = await identityCall('signInWithPassword', {
    email: email.trim(),
    password,
    returnSecureToken: true,
  });
  return toSession(payload);
}

export async function signUpWithPassword(email: string, password: string): Promise<FirebaseSession> {
  const payload = await identityCall('signUp', {
    email: email.trim(),
    password,
    returnSecureToken: true,
  });
  return toSession(payload);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await identityCall('sendOobCode', { requestType: 'PASSWORD_RESET', email: email.trim() });
}

export async function refreshSession(refreshToken: string): Promise<FirebaseSession> {
  let response: Response;
  try {
    response = await fetch(`${TOKEN}?key=${FIREBASE.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    });
  } catch {
    throw new AuthError('Could not refresh your session. Check your connection.', 'network');
  }

  const payload = (await response.json().catch(() => ({}))) as {
    id_token?: string;
    refresh_token?: string;
    user_id?: string;
    expires_in?: string;
    error?: { message?: string } | string;
  };

  if (!response.ok || !payload.id_token || !payload.user_id) {
    const raw = typeof payload.error === 'string' ? payload.error : payload.error?.message;
    if (raw === 'TOKEN_EXPIRED' || raw === 'USER_NOT_FOUND' || raw === 'INVALID_REFRESH_TOKEN') {
      throw new AuthError('Your session has expired. Sign in again.', 'session_expired');
    }
    throw new AuthError('Could not refresh your session. Sign in again.', raw || 'refresh_failed');
  }

  const expiresIn = Number(payload.expires_in ?? '3600');
  return {
    uid: payload.user_id,
    email: '',
    idToken: payload.id_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
}
