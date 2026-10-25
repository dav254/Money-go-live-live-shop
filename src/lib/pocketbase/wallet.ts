/**
 * Wallet collections on PocketBase — the "money trail" section of the
 * Firestore → self-hosting migration.
 *
 * Three collections travel together because they are one ledger from three
 * doors: `payments` (money in — Paystack/PayPal webhooks, points purchases),
 * `walletTransactions` (credits/debits — refunds reverse the buyer, seller,
 * reseller and platform shares) and `payouts` (money out — seller withdrawal
 * requests). Firestore stays the primary write target for all three (the
 * client creates payout requests and simulation payments directly); these
 * helpers mirror every write here and serve the admin reads VPS-first, so the
 * money trail survives whatever Firestore does.
 *
 * Same rules as the other section mirrors:
 *  - `fsId` = the Firestore doc id, so the mirror is re-runnable.
 *  - indexed scalar columns for the filters routes actually run + the FULL
 *    document in `data`, Timestamps converted to ISO strings.
 *  - every helper returns null/false when PocketBase is not configured and
 *    NEVER throws — a mirror failure must never fail a payment.
 *  - reads: this store FIRST, Firestore second (callers fall back on null).
 */

import {
  ensureCollection,
  pbCreateRecord,
  pbListRecords,
  pocketBaseEnabled,
  pbRequest,
  scrubForPocketBase,
  type PbField,
  type PbRecord,
} from './server';

export const PAYOUTS_COLLECTION = 'payouts';
export const WALLET_TRANSACTIONS_COLLECTION = 'wallet_transactions';
export const PAYMENTS_COLLECTION = 'payments';

export const PAYOUT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'sellerId', type: 'text' },
  { name: 'amount', type: 'number' },
  { name: 'status', type: 'text' },
  { name: 'requestedAt', type: 'date' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

export const WALLET_TRANSACTION_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'userId', type: 'text' },
  { name: 'orderId', type: 'text' },
  { name: 'type', type: 'text' },
  { name: 'amount', type: 'number' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

export const PAYMENT_FIELDS: PbField[] = [
  { name: 'fsId', type: 'text', required: true },
  { name: 'orderId', type: 'text' },
  { name: 'userId', type: 'text' },
  { name: 'amount', type: 'number' },
  { name: 'paymentMethod', type: 'text' },
  { name: 'paymentStatus', type: 'text' },
  { name: 'transactionType', type: 'text' },
  { name: 'createdAt', type: 'date' },
  { name: 'data', type: 'json' },
];

const esc = (value: string) => value.replace(/'/g, "\\'");

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function iso(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

async function findByFsId(collection: string, fsId: string): Promise<PbRecord | null> {
  const rows = await pbListRecords(collection, {
    filter: `fsId = '${esc(fsId)}'`,
    perPage: 1,
  });
  return rows[0] ?? null;
}

/**
 * Generic full-document mirror (create or overwrite). Column extraction is
 * done by the typed wrappers below. Never throws; false = PB off or failed.
 */
async function mirrorRecord(
  collection: string,
  fields: PbField[],
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  if (!pocketBaseEnabled()) return false;
  try {
    await ensureCollection(collection, fields);
    const clean = scrubForPocketBase(data) as Record<string, unknown>;
    const body = JSON.stringify({ fsId, ...columnsFor(collection, clean), data: clean });
    const existing = await findByFsId(collection, fsId);
    if (existing) {
      const res = await pbRequest(
        `/api/collections/${collection}/records/${existing.id}`,
        { method: 'PATCH', body },
      );
      return res.ok;
    }
    await pbCreateRecord(collection, JSON.parse(body));
    return true;
  } catch (error) {
    console.error(`[pocketbase] ${collection} mirror failed:`, error);
    return false;
  }
}

/** The indexed columns each ledger collection keeps (empty data-safe). */
function columnsFor(collection: string, d: Record<string, unknown>): Record<string, unknown> {
  switch (collection) {
    case PAYOUTS_COLLECTION:
      return {
        sellerId: str(d.sellerId) ?? '',
        amount: num(d.amount) ?? 0,
        status: str(d.status) ?? '',
        requestedAt: iso(d.requestedAt) ?? iso(d.createdAt),
        createdAt: iso(d.createdAt) ?? iso(d.requestedAt),
      };
    case WALLET_TRANSACTIONS_COLLECTION:
      return {
        userId: str(d.userId) ?? '',
        orderId: str(d.orderId) ?? '',
        type: str(d.type) ?? '',
        amount: num(d.amount) ?? 0,
        createdAt: iso(d.timestamp) ?? iso(d.createdAt),
      };
    case PAYMENTS_COLLECTION:
      return {
        orderId: str(d.orderId) ?? '',
        userId: str(d.userId) ?? '',
        amount: num(d.amount) ?? 0,
        paymentMethod: str(d.paymentMethod) ?? '',
        paymentStatus: str(d.paymentStatus) ?? '',
        transactionType: str(d.transactionType) ?? '',
        createdAt: iso(d.paymentDate) ?? iso(d.createdAt),
      };
    default:
      return {};
  }
}

/** Mirror one payment (money in) to the VPS store. Never throws. */
export async function pbMirrorPayment(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  return mirrorRecord(PAYMENTS_COLLECTION, PAYMENT_FIELDS, fsId, data);
}

/** Mirror one wallet transaction (credit/debit) to the VPS store. Never throws. */
export async function pbMirrorWalletTransaction(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  return mirrorRecord(WALLET_TRANSACTIONS_COLLECTION, WALLET_TRANSACTION_FIELDS, fsId, data);
}

/** Mirror one payout request to the VPS store. Never throws. */
export async function pbMirrorPayout(
  fsId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  return mirrorRecord(PAYOUTS_COLLECTION, PAYOUT_FIELDS, fsId, data);
}

/**
 * Total of the PENDING payout requests — the admin strip's number. Served
 * from the VPS store first; null when PocketBase is off or the read failed so
 * the caller can fall back to Firestore (and degrade as before).
 */
export async function pbPendingPayoutTotal(): Promise<number | null> {
  if (!pocketBaseEnabled()) return null;
  try {
    await ensureCollection(PAYOUTS_COLLECTION, PAYOUT_FIELDS);
    let total = 0;
    for (let page = 1; ; page++) {
      const rows = await pbListRecords(PAYOUTS_COLLECTION, {
        filter: `status = 'pending'`,
        fields: 'data',
        perPage: 500,
        page,
      });
      for (const r of rows) {
        const data = (r.data ?? null) as Record<string, unknown> | null;
        total += num(data?.amount) ?? 0;
      }
      if (rows.length < 500) break;
    }
    return total;
  } catch (error) {
    console.error('[pocketbase] pending payout total failed:', error);
    return null;
  }
}
