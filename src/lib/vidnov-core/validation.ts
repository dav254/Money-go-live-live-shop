/**
 * VIDNOV CORE ENGINE — input validation (zod).
 *
 * One place where every engine API boundary is parsed. Conventions follow the
 * rest of the repo (zod is already a dependency, used across forms/routes).
 *
 * Rules encoded here:
 *   • unknown keys are STRIPPED (`.strict()` where the shape must not grow),
 *     so a forged body can never smuggle `sellerId`, counters, prices or
 *     payable amounts past the schema;
 *   • every string is length-bounded and every number is range-bounded before
 *     it reaches Firestore;
 *   • money is integer minor units + explicit ISO-4217 currency — never a
 *     float, never client-set "balance".
 */

import { z } from 'zod';
import {
  CHANNEL_IDS,
  CONFIRMATION_STATES,
  CORE_EVENT_TYPES,
  DOC_ID_PATTERN,
  EVENT_ENTITY_KINDS,
  JOB_STATUSES,
} from './types';
import { APPLICATION_STATES } from './opportunities/types';

/** Bare document ids — never paths, never URLs. */
export const docIdSchema = z.string().regex(DOC_ID_PATTERN, 'Invalid id.');

/** ISO-4217 alphabetic code, uppercase. */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO code.');

/**
 * Integer minor units (kobo/cents). Bounded above at 10^12 minor units
 * (10 billion major units for a 2-decimal currency) — far above any real
 * task budget, and small enough to keep arithmetic exact.
 */
export const amountMinorSchema = z
  .number()
  .int('Amount must be an integer number of minor units.')
  .positive()
  .max(1_000_000_000_000);

/* ── Distribution Hub ────────────────────────────────────────────────────── */

export const createDistributionJobSchema = z
  .object({
    productId: docIdSchema,
    channel: z.enum(CHANNEL_IDS),
    /**
     * Optional caller key for explicit retries. Deterministic job ids mean a
     * double-submitted request resolves to the same document either way.
     */
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid idempotency key.').optional(),
  })
  .strict();

/**
 * Job document ids are minted by `distributionJobId` (`dj_` + 40 hex), so
 * the API accepts exactly that shape — never a path, never an arbitrary
 * string that could reach another collection.
 */
export const distributionJobIdSchema = z.string().regex(/^dj_[0-9a-f]{40}$/, 'Invalid job id.');

/** Listing-scoped job list: an OPTIONAL product id, nothing else. */
export const listDistributionJobsSchema = z
  .object({
    productId: docIdSchema.optional(),
  })
  .strict();

/**
 * Status-change request. Deliberately just the TARGET state:
 * there is no field for a seller id, a counter, an upstream response, or an
 * error string a client could craft to fake a retryable failure class — the
 * caller names the state, the server decides everything else.
 */
export const transitionJobSchema = z
  .object({
    to: z.enum(JOB_STATUSES),
  })
  .strict();

/** Retry takes no input: the job record alone decides eligibility. */
export const retryJobSchema = z.object({}).strict();

/* ── Distribution Control Center (admin) ──────────────────────────────── */

/**
 * Config updates. Every value is optional (partial patch), bounded, and
 * there is deliberately NO field for a credential — connection secrets live
 * in the environment, never in a request body.
 */
export const updateDistributionConfigSchema = z
  .object({
    paused: z.boolean().optional(),
    maxPerRun: z.number().int().min(1).max(50).optional(),
    maxPerDay: z.number().int().min(1).max(1000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

/** Reconciliation sweep bounds — hard-capped windows, never full scans. */
export const reconcileRequestSchema = z
  .object({
    productLimit: z.number().int().min(1).max(200).optional(),
    jobLimit: z.number().int().min(1).max(300).optional(),
  })
  .strict();

/** Growth funnel window — bounded; a funnel wider than a quarter is noise. */
export const growthFunnelQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).optional(),
  })
  .strict();

/** Admin job queue filters — equality fields only, all bounded. */
export const listAdminDistributionJobsSchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  destination: z.enum(CHANNEL_IDS).optional(),
  confirmation: z.enum(CONFIRMATION_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/** Audit history page — a bounded limit, nothing else. */
export const listAuditSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/* ── Events ──────────────────────────────────────────────────────────────── */

/**
 * Server-side engine event input. There is deliberately NO field for a
 * counter, a seller id, a price or an order value — outcomes recorded through
 * this schema are built by trusted services, and origin is set by the server,
 * never taken from the request.
 */
export const recordEventSchema = z
  .object({
    type: z.enum(CORE_EVENT_TYPES),
    entityKind: z.enum(EVENT_ENTITY_KINDS),
    entityId: docIdSchema,
    /** Campaign id from a tracked link, if present. */
    campaign: z.string().max(64).regex(/^[A-Za-z0-9_-]+$/, 'Invalid campaign id.').optional(),
    /** Existing referral code format (lib/referrals). */
    ref: z.string().max(40).regex(/^[a-z0-9-]+$/, 'Invalid ref code.').optional(),
    channel: z.enum(CHANNEL_IDS).optional(),
    /** Optional deterministic key: same key ⇒ one recorded event. */
    dedupeKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9_:.-]+$/).optional(),
  })
  .strict();

/* ── Opportunities ───────────────────────────────────────────────────────── */

export const opportunityStateSchema = z.enum(['draft', 'open', 'closed', 'cancelled']);

export const createOpportunitySchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(4000),
    /** FUNDING DECLARATION in integer minor units — not a payable balance. */
    budget: z
      .object({
        amountMinor: amountMinorSchema,
        currency: currencySchema,
      })
      .strict(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    eligibility: z.string().trim().max(500).optional(),
    completionCriteria: z.string().trim().min(5).max(2000),
    /** Only drafts and open opportunities can be created by an admin funder. */
    state: z.enum(['draft', 'open']).default('open'),
  })
  .strict()
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    message: 'endsAt must be after startsAt.',
    path: ['endsAt'],
  });

export const listOpportunitiesSchema = z.object({
  state: opportunityStateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const applyToOpportunitySchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const reviewApplicationSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * Application document ids are `<opportunityId>__<uid>` (see
 * `applicationDocId`) and are deliberately longer than a plain doc id, so they
 * get their own bounded pattern — still no `/`, no `.`, no path segments.
 */
export const applicationDocIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,300}$/, 'Invalid application id.');

/** Admin review request: the application id, the explicit decision and an
 *  optional reason. There is NO field for a reviewer uid or an outcome — both
 *  are derived server-side from the verified admin identity. */
export const reviewApplicationRequestSchema = z
  .object({
    applicationId: applicationDocIdSchema,
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listApplicationsSchema = z.object({
  state: z.enum(APPLICATION_STATES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

/* ── Search ──────────────────────────────────────────────────────────────── */

/**
 * Public search params. `q` is treated as PLAIN TEXT everywhere (no regex is
 * ever built from it), length-bounded, and `limit` is capped so one request
 * can never turn into an unbounded read.
 */
export const searchParamsSchema = z.object({
  q: z.string().trim().max(200).default(''),
  category: z.string().trim().max(80).optional(),
  location: z.string().trim().max(80).optional(),
  /** `1` / `true` to only show in-stock/available listings. */
  inStockOnly: z.enum(['1', 'true', '0', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export type CreateDistributionJobInput = z.infer<typeof createDistributionJobSchema>;
export type RecordEventInput = z.infer<typeof recordEventSchema>;
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type ApplyToOpportunityInput = z.infer<typeof applyToOpportunitySchema>;
export type SearchParamsInput = z.infer<typeof searchParamsSchema>;
