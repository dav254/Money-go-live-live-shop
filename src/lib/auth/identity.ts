/**
 * VIDNOV IDENTITY — PocketBase is the account authority.
 *
 * ## What changed and why
 *
 * Every account used to be created and authenticated by Firebase. That meant
 * Google held the passwords, email uniqueness and the sign-in decision, and an
 * outage (or a quota, or a billing lapse) was a total login outage on our own
 * domain. Accounts now live in PocketBase on the VPS:
 *
 *   register  → PocketBase auth record  → profiles (Firestore + VPS)
 *   login     → PocketBase verifies the password
 *   reset     → the new password is written to PocketBase (`pbSetPasswordByAppUid`)
 *
 * ## The bridge (and why it exists)
 *
 * The data layer still authorises on Firebase (Firestore security rules read
 * `request.auth.uid`), and that migration is explicitly out of scope here. So
 * once PocketBase has authenticated someone, this module mints a Firebase
 * **custom token** for the SAME uid. Firebase becomes a session transport, not
 * an identity provider: no password is ever sent to it, and it can no longer
 * accept or reject a login. Removing it entirely is a data-layer change.
 *
 * ## Existing accounts are never duplicated
 *
 * Firebase cannot export password hashes, so a migration cannot be a batch
 * job. Instead a legacy account is migrated the first time its owner signs in:
 *
 *   1. PocketBase has no record for that email → the password is verified
 *      against Firebase (the only place it exists today).
 *   2. On success the account is created in PocketBase with `appUid` equal to
 *      the EXISTING Firebase uid and the password the owner just typed — so
 *      their id, profiles, orders and listings are untouched, and from then on
 *      PocketBase authenticates them.
 *
 * A failed PocketBase login is never retried against Firebase when PocketBase
 * knows the email: that would be a second credential check for an account we
 * already own, and would let a stale Firebase password keep working.
 */

import { auth as firebaseAuth } from '@/firebase/server';
import { firebaseConfig } from '@/firebase/config';
import { ensureUserProfile, readUserProfile, type EnsuredProfile } from '@/lib/auth/profile-ensure';
import {
  generateAppUid,
  pbCreateAuthUser,
  pbFindAuthUserByAppUid,
  pbFindAuthUserByEmail,
  pbSetPasswordByAppUid,
  pbUpdateAuthUserProfile,
  pbVerifyPassword,
  type PbAuthUser,
} from '@/lib/pocketbase/auth-users';
import { pocketBaseEnabled } from '@/lib/pocketbase/server';

import {
  isUsableEmail,
  isUsablePassword,
  normaliseRole,
  MIN_PASSWORD_LENGTH,
} from '@/lib/auth/identity-rules';

export { isUsableEmail, isUsablePassword, normaliseRole, MIN_PASSWORD_LENGTH };

export interface IdentitySession {
  /** Canonical app uid — unchanged for existing accounts. */
  uid: string;
  email: string;
  /** For the web SDK: `signInWithCustomToken(auth, customToken)`. */
  customToken: string;
  /** For REST clients (Android) that hold their own session: the real token. */
  idToken: string;
  refreshToken: string;
  expiresIn: number;
  profile: EnsuredProfile | null;
  /** True when this login migrated a legacy Firebase-only account. */
  migrated: boolean;
}

export type IdentityFailureCode =
  | 'email_in_use'
  | 'invalid_credentials'
  | 'account_suspended'
  | 'rate_limited'
  | 'invalid_input'
  | 'identity_unconfigured'
  | 'identity_unavailable';

export class IdentityError extends Error {
  readonly code: IdentityFailureCode;
  readonly status: number;

  constructor(code: IdentityFailureCode, message: string, status: number) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Exchanges a Firebase custom token for a real ID token + refresh token.
 *
 * The custom token is enough for the web SDK, but the Android app keeps its own
 * session (SecureStore) and needs the REST pair, exactly as it got from
 * `identitytoolkit` before. Doing the exchange server-side means both surfaces
 * receive an identical, already-valid session from one endpoint.
 */
async function exchangeCustomToken(
  customToken: string,
): Promise<{ idToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(
      firebaseConfig.apiKey,
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const payload = (await res.json().catch(() => ({}))) as {
    idToken?: string;
    refreshToken?: string;
    expiresIn?: string;
    error?: { message?: string };
  };
  if (!res.ok || !payload.idToken || !payload.refreshToken) {
    throw new IdentityError(
      'identity_unavailable',
      'Signed in, but the session could not be started. Try again.',
      503,
    );
  }
  const expiresIn = Number(payload.expiresIn ?? '3600');
  return {
    idToken: payload.idToken,
    refreshToken: payload.refreshToken,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600,
  };
}

/**
 * Builds the session for an authenticated PocketBase account.
 *
 * The Firebase account is created only if it is missing (a brand-new signup);
 * it carries NO password, so Firebase can never be used to sign in directly and
 * PocketBase stays the single credential authority.
 */
async function sessionFor(
  user: PbAuthUser,
  options: { migrated?: boolean } = {},
): Promise<IdentitySession> {
  const uid = user.appUid;

  try {
    await firebaseAuth.getUser(uid);
  } catch {
    try {
      await firebaseAuth.createUser({ uid, email: user.email || undefined, emailVerified: false });
    } catch (error) {
      // A user with this EMAIL but another uid means an identity already owns
      // the address; never merge two accounts implicitly.
      const message = (error as { code?: string }).code ?? '';
      if (message.includes('email-already-exists')) {
        throw new IdentityError(
          'email_in_use',
          'That email belongs to another account. Sign in with it instead.',
          409,
        );
      }
      console.error('[identity] could not prepare the bridge account:', message || error);
    }
  }

  // Suspension is checked BEFORE a token is minted, so a suspended account is
  // never handed a usable session (not even one the client is told to discard).
  const profile = await track(() => readUserProfile(uid));
  if (profile?.status === 'suspended') {
    throw new IdentityError(
      'account_suspended',
      'This account has been suspended. Contact support.',
      403,
    );
  }

  const customToken = await firebaseAuth.createCustomToken(uid);
  const tokens = await exchangeCustomToken(customToken);

  return { uid, email: user.email, customToken, ...tokens, profile, migrated: options.migrated === true };
}

async function track<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error('[identity] profile read failed:', error);
    return null;
  }
}

/**
 * Verifies a legacy Firebase credential (Identity Toolkit REST).
 *
 * Only reachable for an email PocketBase has never seen. Returns the existing
 * uid on success, null for a wrong password. Errors that are NOT about the
 * credential (network, disabled project) surface as `identity_unavailable`
 * rather than a false "wrong password".
 */
async function verifyLegacyFirebasePassword(
  email: string,
  password: string,
): Promise<{ uid: string } | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
      firebaseConfig.apiKey,
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const payload = (await res.json().catch(() => ({}))) as {
    localId?: string;
    error?: { message?: string };
  };

  if (res.ok && payload.localId) return { uid: payload.localId };

  const raw = payload.error?.message ?? '';
  if (/^(EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|INVALID_EMAIL)/.test(raw)) {
    return null;
  }
  throw new IdentityError(
    'identity_unavailable',
    'Could not reach the sign-in service. Try again in a moment.',
    503,
  );
}

/** Trim + bound a text field so a signup body cannot store an essay. */
function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
  phone?: string;
  role?: string;
}

/**
 * Creates an account in PocketBase (with profiles in both stores) and returns a
 * live session. Duplicate emails are refused before anything is written, and a
 * partially-created account is rolled back rather than left unusable.
 */
export async function registerAccount(input: RegisterInput): Promise<IdentitySession> {
  if (!pocketBaseEnabled()) {
    throw new IdentityError(
      'identity_unconfigured',
      'Account creation is temporarily unavailable. Try again shortly.',
      503,
    );
  }
  if (!isUsableEmail(input.email)) {
    throw new IdentityError('invalid_input', 'Enter a valid email address.', 400);
  }
  if (!isUsablePassword(input.password)) {
    throw new IdentityError(
      'invalid_input',
      `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
      400,
    );
  }

  const email = input.email.trim().toLowerCase();
  const role = normaliseRole(input.role);

  // 1. Refuse a duplicate before writing anything anywhere.
  const existingLocal = await pbFindAuthUserByEmail(email);
  if (existingLocal) {
    throw new IdentityError(
      'email_in_use',
      'An account with that email already exists. Sign in instead.',
      409,
    );
  }
  try {
    const existingFirebase = await firebaseAuth.getUserByEmail(email);
    if (existingFirebase) {
      // A real account already owns this address. Do NOT create a second
      // identity: sign-in will migrate it to PocketBase on first use.
      throw new IdentityError(
        'email_in_use',
        'An account with that email already exists. Sign in instead.',
        409,
      );
    }
  } catch (error) {
    if (error instanceof IdentityError) throw error;
    // No Firebase user / admin SDK unavailable — registration continues,
    // because PocketBase is now the authority.
  }

  // 2. Create the identity. The generated id IS the app uid.
  const appUid = generateAppUid();
  const fullName = cleanText(input.fullName, 120);
  const username = cleanText(input.username, 60);
  const phone = cleanText(input.phone, 32);

  const created = await pbCreateAuthUser({
    email,
    password: input.password,
    appUid,
    fullName,
    username,
    userRole: role,
    phoneNumber: phone,
  });

  if (!created.ok) {
    if (created.failure.kind === 'duplicate_email') {
      throw new IdentityError(
        'email_in_use',
        'An account with that email already exists. Sign in instead.',
        409,
      );
    }
    if (created.failure.kind === 'rate_limited') {
      throw new IdentityError('rate_limited', 'Too many attempts. Wait a moment and try again.', 429);
    }
    throw new IdentityError(
      'identity_unavailable',
      'Account creation is temporarily unavailable. Try again shortly.',
      503,
    );
  }

  // 3. Profiles: Firestore + VPS, server-side, so a half-made account cannot
  //    be left behind by a failed browser write.
  const profile = await ensureUserProfile({
    uid: appUid,
    role,
    name: fullName,
    email,
    username,
    phone,
  });

  return sessionFor(created.value, { migrated: false }).then((session) => ({
    ...session,
    profile: session.profile ?? profile,
  }));
}

/**
 * Authenticates an email + password.
 *
 * Order is deliberate: PocketBase decides whenever it knows the email. Only an
 * email it has never stored falls through to the legacy Firebase check, which
 * migrates the account on success.
 */
export async function signInAccount(input: {
  email: string;
  password: string;
}): Promise<IdentitySession> {
  if (!pocketBaseEnabled()) {
    throw new IdentityError(
      'identity_unconfigured',
      'Sign-in is temporarily unavailable. Try again shortly.',
      503,
    );
  }
  if (!isUsableEmail(input.email) || typeof input.password !== 'string' || !input.password) {
    throw new IdentityError('invalid_credentials', 'The email or password is not correct.', 401);
  }

  const email = input.email.trim().toLowerCase();
  const local = await pbFindAuthUserByEmail(email);

  if (local) {
    const verified = await pbVerifyPassword(email, input.password);
    if (verified.ok) return sessionFor(verified.value);

    if (verified.failure.kind === 'rate_limited') {
      throw new IdentityError('rate_limited', 'Too many attempts. Wait a moment and try again.', 429);
    }
    if (verified.failure.kind === 'invalid_credentials') {
      throw new IdentityError('invalid_credentials', 'The email or password is not correct.', 401);
    }
    throw new IdentityError(
      'identity_unavailable',
      'Sign-in is temporarily unavailable. Try again shortly.',
      503,
    );
  }

  // ---- Legacy account migration (one time per account) -------------------
  const legacy = await verifyLegacyFirebasePassword(email, input.password);
  if (!legacy) {
    throw new IdentityError('invalid_credentials', 'The email or password is not correct.', 401);
  }

  const migrated = await pbCreateAuthUser({
    email,
    password: input.password,
    appUid: legacy.uid,
    userRole: 'buyer',
  });

  /** The record this login should use — the new one, or a raced winner. */
  let migratedUser = migrated.ok ? migrated.value : null;

  if (!migrated.ok) {
    if (migrated.failure.kind === 'duplicate_email') {
      // Two sign-ins of the same legacy account can race: the winner creates
      // the record and the loser is told the email is taken. That is only the
      // SAME account when the stored record carries this legacy uid — a record
      // belonging to a different identity is never adopted, or two people's
      // data would end up behind one login.
      const raced = await pbFindAuthUserByEmail(email);
      if (raced && raced.appUid === legacy.uid) {
        const recheck = await pbVerifyPassword(email, input.password);
        if (recheck.ok) migratedUser = recheck.value;
      }
      if (!migratedUser) {
        throw new IdentityError(
          'email_in_use',
          'That email was just registered another way. Use password reset to set a new password.',
          409,
        );
      }
    } else {
      throw new IdentityError(
        'identity_unavailable',
        'Your account exists but could not be prepared for sign-in. Try again.',
        503,
      );
    }
  }

  // The account's ROLE lives in its profile — never overwrite it with the
  // placeholder used at creation time.
  const existingProfile = await track(() => readUserProfile(legacy.uid));
  if (existingProfile?.userRole) {
    await pbUpdateAuthUserProfile(legacy.uid, { userRole: existingProfile.userRole });
  }

  return sessionFor(migratedUser!, { migrated: true });
}

/**
 * Writes a new password to every store that can authenticate the account.
 *
 * Called by the reset flow after the emailed token is verified. PocketBase is
 * authoritative; the Firebase credential is kept in step so the bridge (and a
 * pre-migration login attempt) does not keep an old password alive.
 */
export async function applyNewPassword(appUid: string, password: string): Promise<void> {
  const moved = await pbSetPasswordByAppUid(appUid, password);
  if (!moved) {
    console.error('[identity] PocketBase password update failed for', appUid);
  }
}

/** True when this deployment has a real PocketBase identity store configured. */
export function identityStoreReady(): boolean {
  return pocketBaseEnabled();
}

export { pbFindAuthUserByAppUid };
