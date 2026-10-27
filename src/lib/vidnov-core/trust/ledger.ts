/**
 * VALUE LEDGER — design-only. NO PAYOUTS, NO WRITES, NO ENDPOINTS.
 *
 * This module defines the shape and invariants a future double-entry ledger
 * must satisfy so that later work cannot invent money. It deliberately has:
 *   • no Firestore access,
 *   • no create/update functions,
 *   • no connection to the existing wallet (`userProfiles.aiPoints`,
 *     seller balances) — existing balances are untouched and unmigrated.
 *
 * ── Controls REQUIRED before any financial transaction is enabled ──────────
 * 1. Funder funding is webhook-verified (payment provider → server) before a
 *    `funding_hold` entry exists; budget declarations alone never credit.
 * 2. Balances are COMPUTED from immutable entries — never a client- or
 *    admin-writable "balance" field.
 * 3. Every entry carries a unique `idempotencyKey`; all money movement goes
 *    through one server path that upserts by that key (exactly-once).
 * 4. Entries are immutable: corrections are new `reversal` entries, never
 *    edits or deletes.
 * 5. Approval and payout are separated by role (maker-checker) with audit
 *    records (`logSecurityEvent` exists for this).
 * 6. Payout provider has webhook signature verification + idempotent
 *    processing (mirrors the existing PayPal/Paystack webhook handling).
 * 7. Currency never changes across a transaction chain; minor units are
 *    integers end to end (no floats, ever).
 * 8. Reconciliation job compares computed balances vs provider statements.
 *
 * Only after 1–8 are reviewed and tested does a `createLedgerEntry` function
 * get written — in a later, separately reviewed change.
 */

import { z } from 'zod';

export const LEDGER_ENTRY_TYPES = [
  'funding_hold', // funder's webhook-verified deposit reserved for a task
  'reward_approved', // approved earning moving from funder reserve to earner
  'fee', // platform fee
  'reversal', // correction of a prior entry (never an edit)
  'payout', // transfer out to a real payment method
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

/** Account sides are existing entity refs — no parallel identity system. */
export interface LedgerAccount {
  kind: 'funder' | 'earner' | 'platform' | 'payout_provider';
  /** uid for funder/earner; fixed string for platform/provider. */
  id: string;
}

export const ledgerEntrySchema = z
  .object({
    /** Unique per money movement — all writers upsert on this key. */
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
    type: z.enum(LEDGER_ENTRY_TYPES),
    /** Positive integer minor units; direction is expressed by from/to. */
    amountMinor: z.number().int().positive(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    from: z.object({ kind: z.enum(['funder', 'earner', 'platform', 'payout_provider']), id: z.string().min(1).max(128) }).strict(),
    to: z.object({ kind: z.enum(['funder', 'earner', 'platform', 'payout_provider']), id: z.string().min(1).max(128) }).strict(),
    /** References an existing entity — an application/order id, never free money text. */
    refKind: z.enum(['opportunity', 'application', 'order']),
    refId: z.string().min(1).max(128),
    /** Set only by the server after provider confirmation. */
    createdAt: z.date(),
  })
  .strict()
  .refine((e) => e.from.kind !== e.to.kind || e.from.id !== e.to.id, {
    message: 'Entry must move value between two distinct accounts.',
    path: ['to'],
  });

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/**
 * Computed balance of one account in one currency — the ONLY balance model
 * permitted. Sums must be exact integers; a non-integer anywhere is a bug,
 * not a rounding convenience.
 */
export function computeBalance(entries: readonly LedgerEntry[], account: LedgerAccount, currency: string): number {
  let total = 0;
  for (const e of entries) {
    if (e.currency !== currency) continue; // never mix currencies in one sum
    if (e.to.kind === account.kind && e.to.id === account.id) total += Math.abs(e.amountMinor);
    if (e.from.kind === account.kind && e.from.id === account.id) total -= Math.abs(e.amountMinor);
  }
  if (!Number.isSafeInteger(total)) throw new Error('Balance left safe-integer range.');
  return total;
}

/** Every entry must reference a distinct from/to pair (double-entry sanity). */
export function isValidLedgerEntry(entry: unknown): { ok: true; value: LedgerEntry } | { ok: false; error: string } {
  const parsed = ledgerEntrySchema.safeParse(entry);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry.' };
  return { ok: true, value: parsed.data };
}
