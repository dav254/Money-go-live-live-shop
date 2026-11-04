/**
 * SOCIAL ENGINE — OAuth token encryption (server-only).
 *
 * Stored OAuth tokens are encrypted at rest with AES-256-GCM (task §10).
 * The key comes from `SOCIAL_ENGINE_TOKEN_KEY` — a dedicated variable,
 * because reusing an unrelated secret (a payment or provider key) would
 * couple the rotation and blast radius of two unrelated systems.
 *
 * Absence is a first-class state: with no key the store REFUSES to write
 * plaintext (connect fails with the missing name, never a silent fallback),
 * and reads report that a reconnect is needed. Readiness shows the name as
 * missing configuration until an administrator sets it.
 *
 * Ciphertext format: { v: 1, iv, tag, data } — base64url fields. The
 * plaintext never appears in a log, an error message or an API response.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const VERSION = 1;
const KEY_MIN_LENGTH = 16;

export interface SealedToken {
  v: 1;
  iv: string;
  tag: string;
  data: string;
}

/** The encryption key, or null when SOCIAAL_ENGINE_TOKEN_KEY is absent/short. */
export function tokenKeyPresent(): boolean {
  return resolveKey() !== null;
}

function resolveKey(): Buffer | null {
  const raw = (process.env.SOCIAL_ENGINE_TOKEN_KEY ?? '').trim();
  if (raw.length < KEY_MIN_LENGTH) return null;
  // Domain-separated derivation: the raw value is never used directly, so a
  // raw value reused elsewhere (it shouldn't be) still yields a distinct key.
  return createHash('sha256').update(`social-engine:v${VERSION}:${raw}`).digest();
}

/** Error whose message contains the env NAME only — safe to display. */
export class TokenKeyMissingError extends Error {
  readonly code = 'token_key_missing';
  constructor() {
    super('SOCIAL_ENGINE_TOKEN_KEY is not set — stored OAuth tokens cannot be encrypted.');
  }
}

/** Encrypts a JSON-serialisable token payload. Throws when no key is set. */
export function sealTokens(value: unknown): SealedToken {
  const key = resolveKey();
  if (!key) throw new TokenKeyMissingError();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    v: VERSION,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: data.toString('base64url'),
  };
}

/** Decrypts a sealed payload. Throws on wrong key / tampered ciphertext. */
export function openTokens<T>(sealed: SealedToken): T {
  const key = resolveKey();
  if (!key) throw new TokenKeyMissingError();
  if (!sealed || sealed.v !== VERSION) throw new Error('Unsupported sealed token format.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(sealed.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.data, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}

/** True when a value LOOKS like one of our sealed payloads (never decrypts). */
export function isSealedToken(value: unknown): value is SealedToken {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return s.v === VERSION && typeof s.iv === 'string' && typeof s.tag === 'string' && typeof s.data === 'string';
}
