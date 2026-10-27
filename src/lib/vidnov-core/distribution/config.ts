/**
 * DISTRIBUTION HUB — engine configuration: global pause, safe limits, quotas.
 *
 * One singleton document (`distributionConfig/global`) owns the switches that
 * can stop the engine cold, plus the bounded rate limits it must respect.
 * Written ONLY by admin routes through `updateDistributionConfig`; read by
 * every engine run. Firestore is injected, never imported.
 *
 * Safety rules encoded here:
 *   • **Fail closed** — a missing/unreadable config document yields the SAFE
 *     DEFAULTS (`paused: false` but tight limits); a pause flag that cannot
 *     be read never silently becomes "run anyway at full speed": limits are
 *     still clamped to the hard bounds below.
 *   • **Bounded values** — every limit is an integer inside a hard range;
 *     `updateDistributionConfig` re-validates with zod before writing, so a
 *     compromised admin session still cannot configure unbounded fan-out.
 *   • **Quota is reserved BEFORE submitting** — a per-destination, per-day
 *     counter is claimed transactionally; when the day's budget is spent the
 *     engine skips (rate-limited) without burning the job's retry attempts.
 *
 * Collections used: `distributionConfig`, `distributionQuotas` — both new,
 * server-only, default-deny for clients (no rules change ships with this).
 */

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export const DISTRIBUTION_CONFIG_COLLECTION = 'distributionConfig';
export const DISTRIBUTION_CONFIG_ID = 'global';
export const DISTRIBUTION_QUOTAS_COLLECTION = 'distributionQuotas';

/** Hard bounds — a config value can never escape these. */
export const LIMIT_BOUNDS = {
  maxPerRun: { min: 1, max: 50 },
  maxPerDay: { min: 1, max: 1000 },
} as const;

export interface DistributionConfig {
  /** Global kill switch: while true, the engine performs NO submissions. */
  paused: boolean;
  /** Jobs one engine run may process across all destinations. */
  maxPerRun: number;
  /** Jobs one destination may process per UTC day (before per-dest quotas). */
  maxPerDay: number;
  /** ISO timestamps — admin audit trail on the document itself. */
  pausedAt: string | null;
  pausedBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** When the engine last completed a run (ISO), null before the first. */
  lastRunAt: string | null;
  /** When Search Console last accepted the sitemap submission, null = never. */
  sitemapSubmittedAt: string | null;
}

export const SAFE_DEFAULT_CONFIG: DistributionConfig = {
  paused: false,
  maxPerRun: 10,
  maxPerDay: 100,
  pausedAt: null,
  pausedBy: null,
  updatedAt: null,
  updatedBy: null,
  lastRunAt: null,
  sitemapSubmittedAt: null,
};

/** Clamp an untrusted number into a hard-bounded integer, else the fallback. */
function boundInt(value: unknown, bounds: { min: number; max: number }, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, Math.floor(n)));
}

/** Reads the config; any failure degrades to safe defaults, never to "wide open". */
export async function readDistributionConfig(db: Firestore): Promise<DistributionConfig> {
  try {
    const snap = await db
      .collection(DISTRIBUTION_CONFIG_COLLECTION)
      .doc(DISTRIBUTION_CONFIG_ID)
      .get();
    const raw = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
    return {
      paused: raw.paused === true,
      maxPerRun: boundInt(raw.maxPerRun, LIMIT_BOUNDS.maxPerRun, SAFE_DEFAULT_CONFIG.maxPerRun),
      maxPerDay: boundInt(raw.maxPerDay, LIMIT_BOUNDS.maxPerDay, SAFE_DEFAULT_CONFIG.maxPerDay),
      pausedAt: typeof raw.pausedAt === 'string' ? raw.pausedAt : null,
      pausedBy: typeof raw.pausedBy === 'string' ? raw.pausedBy : null,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
      updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
      lastRunAt: typeof raw.lastRunAt === 'string' ? raw.lastRunAt : null,
      sitemapSubmittedAt:
        typeof raw.sitemapSubmittedAt === 'string' ? raw.sitemapSubmittedAt : null,
    };
  } catch {
    return { ...SAFE_DEFAULT_CONFIG };
  }
}

export interface UpdateConfigPatch {
  paused?: boolean;
  maxPerRun?: number;
  maxPerDay?: number;
}

/**
 * Applies a validated patch. The route parses with zod first; this clamps
 * again anyway (defence in depth) and records WHO changed WHAT and WHEN.
 */
export async function updateDistributionConfig(
  db: Firestore,
  patch: UpdateConfigPatch,
  actorUid: string,
): Promise<DistributionConfig> {
  const ref = db.collection(DISTRIBUTION_CONFIG_COLLECTION).doc(DISTRIBUTION_CONFIG_ID);
  const nowIso = new Date().toISOString();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const raw = (snap.exists ? snap.data() : {}) as Record<string, unknown>;

    const current = {
      paused: raw.paused === true,
      maxPerRun: boundInt(raw.maxPerRun, LIMIT_BOUNDS.maxPerRun, SAFE_DEFAULT_CONFIG.maxPerRun),
      maxPerDay: boundInt(raw.maxPerDay, LIMIT_BOUNDS.maxPerDay, SAFE_DEFAULT_CONFIG.maxPerDay),
    };

    const nextPaused = patch.paused ?? current.paused;
    const next: DistributionConfig = {
      paused: nextPaused,
      maxPerRun: boundInt(
        patch.maxPerRun === undefined ? current.maxPerRun : patch.maxPerRun,
        LIMIT_BOUNDS.maxPerRun,
        current.maxPerRun,
      ),
      maxPerDay: boundInt(
        patch.maxPerDay === undefined ? current.maxPerDay : patch.maxPerDay,
        LIMIT_BOUNDS.maxPerDay,
        current.maxPerDay,
      ),
      // Pause bookkeeping only moves when the flag itself is being changed;
      // a limits-only edit must not rewrite WHO paused the engine or WHEN.
      pausedAt: nextPaused === current.paused ? (typeof raw.pausedAt === 'string' ? raw.pausedAt : null) : nextPaused ? nowIso : null,
      pausedBy: nextPaused === current.paused ? (typeof raw.pausedBy === 'string' ? raw.pausedBy : null) : nextPaused ? actorUid : null,
      updatedAt: nowIso,
      updatedBy: actorUid,
      lastRunAt: typeof raw.lastRunAt === 'string' ? raw.lastRunAt : null,
      sitemapSubmittedAt:
        typeof raw.sitemapSubmittedAt === 'string' ? raw.sitemapSubmittedAt : null,
    };

    tx.set(ref, next);
    return next;
  });
}

/** Marks a completed engine run on the config doc (single-field update). */
export async function markEngineRun(db: Firestore): Promise<void> {
  await db
    .collection(DISTRIBUTION_CONFIG_COLLECTION)
    .doc(DISTRIBUTION_CONFIG_ID)
    .set({ lastRunAt: new Date().toISOString() }, { merge: true });
}

/** Marks the daily sitemap submission so the engine does not repeat it. */
export async function markSitemapSubmitted(db: Firestore): Promise<void> {
  await db
    .collection(DISTRIBUTION_CONFIG_COLLECTION)
    .doc(DISTRIBUTION_CONFIG_ID)
    .set({ sitemapSubmittedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Claims one slot of a destination's daily quota BEFORE a submission.
 * Transactional: two concurrent runs cannot both take the last slot.
 * Returns false (⇒ skip, rate-limited, NO attempt burned) when the budget
 * for today — or the global per-destination ceiling — is already spent.
 */
export async function reserveQuota(
  db: Firestore,
  destination: string,
  perDayLimit: number,
  globalMaxPerDay: number,
  now: Date = new Date(),
): Promise<boolean> {
  const limit = Math.min(
    perDayLimit,
    Math.max(LIMIT_BOUNDS.maxPerDay.min, Math.floor(globalMaxPerDay)),
  );
  const day = now.toISOString().slice(0, 10);
  const ref = db.collection(DISTRIBUTION_QUOTAS_COLLECTION).doc(`${destination}_${day}`);

  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const used = Number((snap.data() as { count?: unknown } | undefined)?.count ?? 0);
      const safeUsed = Number.isFinite(used) ? Math.max(0, Math.floor(used)) : 0;
      if (safeUsed + 1 > limit) return false;
      tx.set(
        ref,
        {
          destination,
          day,
          count: safeUsed + 1,
          limit,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    });
  } catch {
    // Quota store unavailable ⇒ do not submit unthrottled. Fail closed.
    return false;
  }
}
