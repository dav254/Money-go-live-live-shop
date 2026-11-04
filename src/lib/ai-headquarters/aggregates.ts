/**
 * ORBIT — safe, aggregate-only views of Vidnov (task §D/§F).
 *
 * Rules that make these safe to hand to an agent:
 *   • aggregates only — no buyer names, emails, phone numbers, addresses,
 *     messages, payment references or seller credentials ever leave here,
 *   • the funnel is the existing `readGrowthFunnel` (one source of truth,
 *     `null` = unknown, never a fabricated zero),
 *   • every read is bounded (counters + the funnel's own caps),
 *   • the Social Engine view exposes readiness/environment NAMES only — never
 *     a token, never a connection secret, never an upstream error body.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { readGrowthFunnel, type GrowthFunnel } from '@/lib/vidnov-core/distribution/funnel';
import { getAllReadiness } from '@/lib/social-engine/engine';
import type { ModuleReadiness } from '@/lib/social-engine/types';

/** Collections that hold real marketplace records. Counting them is safe. */
const COUNTED = [
  { id: 'sellers', collection: 'sellerShops', label: 'Seller shops' },
  { id: 'products', collection: 'products', label: 'Product listings' },
  { id: 'requests', collection: 'requests', label: 'Buyer requests' },
  { id: 'offers', collection: 'offers', label: 'Seller offers' },
  { id: 'orders', collection: 'orders', label: 'Orders' },
] as const;

export interface CountResult {
  id: string;
  label: string;
  /** `null` = the count could not be read. Never a fabricated zero. */
  count: number | null;
}

/** Bounded counts. A failing count is null, so an agent never reads it as 0. */
export async function readCounts(db: Firestore): Promise<CountResult[]> {
  const results = await Promise.all(
    COUNTED.map(async (entry) => {
      try {
        const snap = await db.collection(entry.collection).count().get();
        return { id: entry.id, label: entry.label, count: snap.data().count };
      } catch {
        return { id: entry.id, label: entry.label, count: null };
      }
    }),
  );
  return results;
}

export interface MarketplaceSummary {
  windowDays: number;
  counts: CountResult[];
  funnel: GrowthFunnel | null;
  /** Present when the funnel read failed — the reason, sanitized. */
  funnelNote?: string;
}

export async function readMarketplaceSummary(
  db: Firestore,
  days = 30,
): Promise<MarketplaceSummary> {
  const windowDays = Math.min(90, Math.max(1, Math.floor(days) || 30));
  const counts = await readCounts(db);
  try {
    const funnel = await readGrowthFunnel(db, windowDays);
    return { windowDays, counts, funnel };
  } catch {
    return {
      windowDays,
      counts,
      funnel: null,
      funnelNote: 'The growth funnel could not be read right now.',
    };
  }
}

/** One module, reduced to what an agent may see. */
export interface SocialPlatformView {
  id: string;
  label: string;
  state: string;
  missingEnvVars: string[];
  approvalRequired: boolean;
  approvalGranted: boolean;
  connected: boolean;
  lastDiagnosticAt?: string;
  lastPublishAt?: string;
  lastErrorNote?: string;
  nextStep: string;
}

export interface SocialSummary {
  generatedAt: string;
  platforms: SocialPlatformView[];
  ready: string[];
  approvalRequired: string[];
  notConfigured: string[];
}

/**
 * Platform readiness from the real engine. The `caller` is a system identity,
 * not an agent: readiness is platform-level (env + recorded tests + approval),
 * and no agent-specific connection is ever read here.
 */
export async function readSocialSummary(
  env: Record<string, string | undefined> = process.env,
): Promise<SocialSummary> {
  const modules: ModuleReadiness[] = await getAllReadiness({
    env,
    caller: { uid: 'system:orbit', isAdmin: true },
  });

  const platforms = modules.map((module) => ({
    id: module.id,
    label: module.label,
    state: module.state,
    missingEnvVars: module.missingEnvVars,
    approvalRequired: module.approval.required,
    approvalGranted: module.approval.granted,
    connected: module.connection.connected,
    lastDiagnosticAt: module.lastDiagnostic?.at,
    lastPublishAt: module.lastPublishTest?.at,
    lastErrorNote: module.lastError?.note,
    nextStep: module.nextStep,
  }));

  return {
    generatedAt: new Date().toISOString(),
    platforms,
    ready: platforms.filter((p) => p.state === 'READY').map((p) => p.id),
    approvalRequired: platforms.filter((p) => p.state === 'APPROVAL_REQUIRED').map((p) => p.id),
    notConfigured: platforms.filter((p) => p.state === 'NOT_CONFIGURED').map((p) => p.id),
  };
}
