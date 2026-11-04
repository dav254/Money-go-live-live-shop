/**
 * ORBIT — token and digest primitives (pure, no I/O).
 *
 * ## Why the token is split
 * An agent credential is `orb_<agentId>_<secret>`. Only the id is stored in
 * clear, so verification is one document read, and only a SHA-256 of the
 * secret is stored, so a database leak does not leak a usable credential.
 *
 * ## Why a digest
 * A proposal is approved for EXACT parameters. Freezing a SHA-256 of the
 * action at creation lets the approve step prove nothing changed in between
 * — "approve this campaign" can never silently become "approve a different
 * campaign".
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ProposalAction } from './types';

export const TOKEN_PREFIX = 'orb_';

export interface IssuedToken {
  /** The full credential — returned ONCE, to the admin who created the agent. */
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests (length mismatch = false). */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function newAgentId(): string {
  return randomBytes(9).toString('hex'); // 18 chars, URL-safe
}

/** Mints a credential. The plaintext is returned exactly once and never stored. */
export function issueToken(agentId: string): IssuedToken {
  const secret = randomBytes(32).toString('hex');
  const token = `${TOKEN_PREFIX}${agentId}_${secret}`;
  return {
    token,
    tokenHash: sha256Hex(secret),
    tokenPrefix: `${TOKEN_PREFIX}${agentId.slice(0, 4)}…${secret.slice(-4)}`,
  };
}

/** Splits a presented Bearer token into its id and secret halves. */
export function parseToken(token: string): { agentId: string; secret: string } | null {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) return null;
  const rest = token.slice(TOKEN_PREFIX.length);
  const cut = rest.indexOf('_');
  if (cut <= 0 || cut === rest.length - 1) return null;
  const agentId = rest.slice(0, cut);
  const secret = rest.slice(cut + 1);
  if (!/^[a-f0-9]{8,64}$/.test(agentId) || !/^[a-f0-9]{32,128}$/.test(secret)) return null;
  return { agentId, secret };
}

/** Recomputes the stored hash for a presented secret. */
export function hashSecret(secret: string): string {
  return sha256Hex(secret);
}

/** Recursively key-sorted JSON, so object key order can never change a digest. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** Digest of the exact action a proposal asks to run. */
export function digestAction(action: ProposalAction): string {
  return sha256Hex(stableStringify({ type: action.type, params: action.params }));
}
