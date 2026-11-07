import { API_BASE_URL, FIREBASE } from './config';

/**
 * VIDNOV IDENTITY (Android).
 *
 * The app no longer talks to Firebase Identity Toolkit for email + password.
 * It calls Vidnov's own `/api/auth/v2/*` endpoints, where PocketBase holds the
 * password hash and makes the sign-in decision. The server returns a session in
 * exactly the shape this module always exposed (`idToken`, `refreshToken`,
 * `expiresAt`), so `auth.tsx`, session restoration and every screen are
 * unchanged.
 *
 * Why the session is still a Firebase token: Firestore security rules read
 * `request.auth.uid`, and that data-layer migration is separate work. The
 * token is minted server-side for the PocketBase-authenticated uid — Firebase
 * never sees the password and never decides whether a login is valid.
 *
 * `refreshSession` keeps using securetoken: it renews an already-issued
 * session, it does not authenticate anyone.
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

interface ApiSession {
  uid?: string;
  email?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

interface ApiResponse {
  ok?: boolean;
  code?: string;
  message?: string;
  session?: ApiSession;
}

export class AuthError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** API failure codes → the sentence the person on the phone should read. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email or password is not correct.',
  email_in_use: 'An account with that email already exists. Sign in instead.',
  account_suspended: 'This account has been suspended. Contact support.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
  invalid_input: 'Check the details you entered and try again.',
  identity_unavailable: 'Vidnov sign-in is briefly unavailable. Try again in a moment.',
  identity_unconfigured: 'Vidnov sign-in is briefly unavailable. Try again in a moment.',
  network: 'Could not reach Vidnov. Check your connection.',
  session_expired: 'Your session has expired. Sign in again.',
};

/** Firebase's error codes are stable; the fallback path still needs sentences. */
const LEGACY_MESSAGES: Record<string, string> = {
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
};

function authError(code: string, fallback: string): AuthError {
  return new AuthError(MESSAGES[code] || fallback, code);
}

async function authCall(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw authError('network', MESSAGES.network);
  }
  return (await response.json().catch(() => ({}))) as ApiResponse;
}

function toSession(payload: ApiSession | undefined): FirebaseSession {
  if (!payload?.idToken || !payload.refreshToken || !payload.uid) {
    throw new AuthError('The sign-in service returned an incomplete session.', 'incomplete');
  }
  const expiresIn = Number(payload.expiresIn ?? 3600);
  return {
    uid: payload.uid,
    email: payload.email ?? '',
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
  };
}

/**
 * Firebase Identity Toolkit fallback — ONLY for a deployment whose API reports
 * that no identity store is configured. It is the pre-migration behaviour, kept
 * so an environment without PocketBase can still sign in.
 */
async function legacyIdentityCall(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<FirebaseSession> {
  let response: Response;
  try {
    response = await fetch(`${IDENTITY}/${endpoint}?key=${FIREBASE.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw authError('network', MESSAGES.network);
  }
  const payload = (await response.json().catch(() => ({}))) as {
    localId?: string;
    email?: string;
    idToken?: string;
    refreshToken?: string;
    expiresIn?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    const raw = payload.error?.message ?? 'UNKNOWN';
    throw new AuthError(
      LEGACY_MESSAGES[raw] || MESSAGES.invalid_credentials,
      raw.replace('auth/', '').split(' ')[0],
    );
  }
  return toSession({
    uid: payload.localId,
    email: payload.email,
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    expiresIn: Number(payload.expiresIn ?? '3600'),
  });
}

export async function signInWithPassword(email: string, password: string): Promise<FirebaseSession> {
  const payload = await authCall('/api/auth/v2/login', { email: email.trim(), password });
  if (payload.ok && payload.session) return toSession(payload.session);
  if (payload.code === 'identity_unconfigured') {
    return legacyIdentityCall('signInWithPassword', {
      email: email.trim(),
      password,
      returnSecureToken: true,
    });
  }
  throw authError(payload.code ?? 'unknown', MESSAGES.invalid_credentials);
}

export async function signUpWithPassword(email: string, password: string): Promise<FirebaseSession> {
  const payload = await authCall('/api/auth/v2/register', { email: email.trim(), password });
  if (payload.ok && payload.session) return toSession(payload.session);
  if (payload.code === 'identity_unconfigured') {
    return legacyIdentityCall('signUp', {
      email: email.trim(),
      password,
      returnSecureToken: true,
    });
  }
  throw authError(payload.code ?? 'unknown', MESSAGES.invalid_credentials);
}

/**
 * Sends the reset link. The endpoint answers generically on purpose (never
 * reveals whether an address has an account), so the app shows the same
 * "check your inbox" message either way.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const payload = await authCall('/api/auth/forgot-password', { email: email.trim() });
  if (payload.ok === false && payload.code === 'identity_unconfigured') {
    await fetch(`${IDENTITY}/sendOobCode?key=${FIREBASE.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: email.trim() }),
    });
  }
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
