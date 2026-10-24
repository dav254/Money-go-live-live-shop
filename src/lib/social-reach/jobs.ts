/**
 * SOCIAL REACH PUBLISHING JOBS — the money safety net.
 *
 * A job document (`social_reach_jobs/{sellerId}__{idempotencyKey}`) records
 * every publish attempt with its point charge, so the invariants survive
 * crashes, timeouts and impatient double-taps:
 *
 *   • A seller is charged AT MOST ONCE per idempotency key (the job doc IS
 *     the dedupe record; creation and the charge happen in one transaction).
 *   • Points are refunded EXACTLY ONCE, and only for definitive failures.
 *   • An UNCERTAIN result (timeout, ambiguous API response) is parked in
 *     `UNKNOWN` and never auto-refunded or auto-retried — reconciling with
 *     TikTok decides the settlement, so we can neither double-charge nor
 *     hand out free posts.
 *   • `PUBLISHED` is only set after TikTok's status endpoint confirms
 *     PUBLISH_COMPLETE — never merely because a request was accepted.
 *
 * Status machine (see canTransition):
 *
 *   RESERVED → SUBMITTING → PUBLISHED            (charged, success)
 *                        ↘ FAILED  → REFUNDED    (definitive API failure)
 *                        ↘ UNKNOWN → REFUNDED    (only after reconciliation)
 */
import { db } from '@/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';
import { SOCIAL_REACH_JOBS_COLLECTION } from './config';

export const SOCIAL_REACH_JOBS = SOCIAL_REACH_JOBS_COLLECTION;

export type JobStatus = 'RESERVED' | 'SUBMITTING' | 'PUBLISHED' | 'FAILED' | 'UNKNOWN' | 'REFUNDED';

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  RESERVED: ['SUBMITTING', 'FAILED', 'REFUNDED'],
  SUBMITTING: ['PUBLISHED', 'FAILED', 'UNKNOWN', 'REFUNDED'],
  PUBLISHED: [],
  FAILED: ['REFUNDED'],
  UNKNOWN: ['PUBLISHED', 'FAILED', 'REFUNDED'], // REFUNDED only via reconciliation
  REFUNDED: [],
};

/** Pure transition guard — the refund-once rule lives here. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Deterministic job id per seller + idempotency key. Two clicks, retries and
 * race requests all converge on the same document — the transactional create
 * then guarantees a single charge.
 */
export function jobDocId(sellerId: string, idempotencyKey: string): string {
  if (!KEY_RE.test(idempotencyKey)) {
    throw new Error('Invalid idempotency key.');
  }
  return `${sellerId}__${idempotencyKey}`;
}

export interface SocialReachJob {
  id: string;
  sellerId: string;
  status: JobStatus;
  pointsCharged: number;
  productId?: string;
  productName?: string;
  caption?: string;
  tiktokVideoId?: string | null;
  errorMessage?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ExistingJob {
  id: string;
  status: JobStatus;
  pointsCharged: number;
  tiktokVideoId?: string | null;
  duplicate: true;
}

/**
 * Atomically: check balance → deduct `cost` points → create the job as
 * RESERVED. A repeat of the same idempotency key returns the existing job
 * WITHOUT charging again.
 */
export async function createJobAndCharge(params: {
  sellerId: string;
  idempotencyKey: string;
  cost: number;
  productId: string;
  productName: string;
  caption: string;
}): Promise<{ job: SocialReachJob } | { job: ExistingJob } | { insufficientPoints: true; balance: number }> {
  const { sellerId, idempotencyKey, cost, productId, productName, caption } = params;
  const id = jobDocId(sellerId, idempotencyKey);
  const jobRef = db.collection(SOCIAL_REACH_JOBS).doc(id);
  const profileRef = db.collection('userProfiles').doc(sellerId);

  const result = await db.runTransaction(async (tx) => {
    const existing = await tx.get(jobRef);
    if (existing.exists) {
      const data = existing.data() as SocialReachJob;
      return { duplicate: true as const, insufficient: false as const, data, balance: 0 };
    }

    const profile = await tx.get(profileRef);
    const balance = Number((profile.data() as { aiPoints?: number } | undefined)?.aiPoints ?? 0);
    if (balance < cost) return { insufficient: true as const, duplicate: false as const, balance, data: null };

    // Same pattern as the AI gateway charge: one transaction, never negative.
    tx.update(profileRef, { aiPoints: FieldValue.increment(-cost) });
    const now = Date.now();
    tx.set(jobRef, {
      id,
      sellerId,
      status: 'RESERVED',
      pointsCharged: cost,
      productId,
      productName,
      caption,
      tiktokVideoId: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    } satisfies SocialReachJob);
    return { duplicate: false as const, insufficient: false as const, balance, data: null };
  });

  if (result.insufficient) return { insufficientPoints: true, balance: result.balance };
  if (result.duplicate && result.data) {
    const d = result.data;
    return { job: { id: d.id, status: d.status, pointsCharged: d.pointsCharged, tiktokVideoId: d.tiktokVideoId ?? null, duplicate: true } };
  }
  return {
    job: {
      id,
      sellerId,
      status: 'RESERVED',
      pointsCharged: cost,
      productId,
      productName,
      caption,
      tiktokVideoId: null,
      errorMessage: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

/**
 * Moves a job to `to`, refunding `cost` points in the SAME transaction the
 * first time it reaches REFUNDED. A second refund attempt is a no-op — the
 * transition guard makes the charge refund-exactly-once.
 */
export async function transitionJob(params: {
  jobId: string;
  to: JobStatus;
  cost?: number;
  tiktokVideoId?: string | null;
  errorMessage?: string | null;
}): Promise<{ ok: boolean; status: JobStatus; refunded: boolean }> {
  const { jobId, to, cost = 0, tiktokVideoId, errorMessage } = params;
  const jobRef = db.collection(SOCIAL_REACH_JOBS).doc(jobId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    if (!snap.exists) return { ok: false, status: 'FAILED' as JobStatus, refunded: false };
    const job = snap.data() as SocialReachJob;
    if (!canTransition(job.status, to)) {
      // Idempotent success: a repeated PUBLISHED transition is fine; a
      // refund attempt after REFUNDED/PUBLISHED must be ignored.
      if (to === 'PUBLISHED' && job.status === 'PUBLISHED') {
        return { ok: true, status: job.status, refunded: false };
      }
      return { ok: false, status: job.status, refunded: false };
    }

    const patch: Record<string, unknown> = { status: to, updatedAt: Date.now() };
    if (typeof tiktokVideoId !== 'undefined') patch.tiktokVideoId = tiktokVideoId;
    if (typeof errorMessage !== 'undefined') patch.errorMessage = errorMessage;
    tx.update(jobRef, patch);

    let refunded = false;
    if (to === 'REFUNDED' && job.pointsCharged > 0 && cost >= 0) {
      tx.update(db.collection('userProfiles').doc(job.sellerId), {
        aiPoints: FieldValue.increment(job.pointsCharged),
      });
      refunded = true;
    }
    return { ok: true, status: to, refunded };
  });
}

/** Owner-scoped history query. Callers must pass the authenticated uid. */
export async function listJobsForSeller(sellerId: string, limit = 50): Promise<SocialReachJob[]> {
  const snap = await db
    .collection(SOCIAL_REACH_JOBS)
    .where('sellerId', '==', sellerId)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(Math.max(limit, 1), 100))
    .get()
    .catch(() => null);
  if (!snap) return [];
  return snap.docs.map((d) => d.data() as SocialReachJob);
}