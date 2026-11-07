/**
 * Identity rules — pure, dependency-free.
 *
 * Kept apart from `identity.ts` (which imports the Firebase Admin SDK) so the
 * registration/login rules can be unit-tested without booting a provider
 * client. These four functions are the whole public contract of a Vidnov
 * account: what an email is, what a password is, and which roles a public form
 * may ever ask for.
 */

/** Roles a public signup form may choose for itself. Never `admin`. */
export const REQUESTABLE_ROLES = ['buyer', 'seller', 'reseller'] as const;

export type RequestableRole = (typeof REQUESTABLE_ROLES)[number];

/** Minimum password length, shared by register, login validation and reset. */
export const MIN_PASSWORD_LENGTH = 8;

/** The email shape every Vidnov signup form accepts. */
export function isUsableEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  return email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isUsablePassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH && value.length <= 200;
}

/**
 * The only safe interpretation of a client-supplied role: anything unknown —
 * including `admin`, in any casing — becomes `buyer`. Admin is granted by
 * trusted server processes, never by a request body.
 */
export function normaliseRole(role: unknown): RequestableRole {
  const value = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return (REQUESTABLE_ROLES as readonly string[]).includes(value)
    ? (value as RequestableRole)
    : 'buyer';
}
