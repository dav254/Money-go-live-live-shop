'use client';

/**
 * GROWTH EVENT SPINE — browser helpers (fire-and-forget by contract).
 *
 * Three jobs:
 *   1. **Session** — none: the anonymous session id is minted SERVER-SIDE as
 *      an httpOnly cookie by POST /api/events itself. JavaScript neither
 *      generates nor sends it, so a page can't rotate its identity to
 *      re-count the same view.
 *   2. **Tracking** (`trackListingView`, `trackShareClick`) — every call
 *      resolves immediately and swallows ALL failures: a blocked request, a
 *      dead server or a full disk must never affect browsing, sharing or
 *      checkout. Views are additionally gated HERE (one attempt per target
 *      per local day) so a refresh loop costs zero network requests, and are
 *      only sent after the documented VIEW_QUALIFY_MS of a visible page —
 *      a load that is closed or hidden immediately never counts. *   3. **Share attribution** (`captureShareRef` / `readStoredShareRef` /
 *    `withShareRef`) — carries the established `?ref=<code>` parameter
 *    (same code format as invite links) from an arriving link into
 *    localStorage (30-day TTL) so signup/checkout can attribute it later.
 *    Codes are normalised to the referral lib's alphabet; nothing else
 *    about the visitor is stored.
 *
 * Failures are silent on purpose — this is measurement, never a dependency.
 */

import {
  VIEW_QUALIFY_MS,
  withShareRef as withShareRefPure,
  type GrowthTargetKind,
} from './events';

// Re-export so product/share surfaces import attribution from one place.
export { withShareRefPure as withShareRef };

const REF_KEY = 'vn_ref';
const REF_AT_KEY = 'vn_ref_at';
const EVENT_PREFIX = 'vn_ev';

/** Share-ref codes are honoured for 30 days from the arriving link. */
const REF_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

interface TrackInput {
  type: 'view' | 'click';
  targetKind: GrowthTargetKind;
  targetId: string;
  platform?: string;
  dwellMs?: number;
}

function send(input: TrackInput): void {
  try {
    if (typeof window === 'undefined') return;
    const key = `${EVENT_PREFIX}_${input.type}_${input.targetKind}_${input.targetId}_${localDayKey()}`;
    if (input.type === 'view' && localStorage.getItem(key)) return; // day gate

    void fetch('/api/events', {
      method: 'POST',
      keepalive: true,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: input.type,
        targetKind: input.targetKind,
        targetId: input.targetId,
        platform: input.platform,
        dwellMs: input.dwellMs,
        ref: readStoredShareRef() || undefined,
      }),
    })
      .then((res) => {
        // Mark the day-gate only on acceptance so a transient failure retries.
        if (res.ok && input.type === 'view') {
          try {
            localStorage.setItem(key, '1');
          } catch {
            /* storage full — harmless */
          }
        }
      })
      .catch(() => {
        /* fire-and-forget: measurement must never surface an error */
      });
  } catch {
    /* never throws */
  }
}

/**
 * Records a qualified listing view after VIEW_QUALIFY_MS of visible page
 * time. Returns a disposer: navigating away before the threshold cancels the
 * view entirely (a glance that never landed is not a view).
 */
export function trackListingView(targetId: string): () => void {
  if (typeof window === 'undefined') return () => undefined;
  let disposed = false;
  const timer = setTimeout(() => {
    if (disposed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    send({ type: 'view', targetKind: 'product', targetId, dwellMs: VIEW_QUALIFY_MS });
  }, VIEW_QUALIFY_MS);
  return () => {
    disposed = true;
    clearTimeout(timer);
  };
}

/** A share tap is itself the action — recorded immediately, deduped per day. */
export function trackShareClick(
  targetKind: GrowthTargetKind,
  targetId: string,
  platform: string,
): void {
  send({ type: 'click', targetKind, targetId, platform });
}

/* ── Share attribution (?ref= on arriving links) ─────────────────────── */

/**
 * Captures `?ref=<code>` from the arriving URL into localStorage (14-day
 * TTL). Normalises through the SAME rules as invite codes. Call once on
 * mount of any page that can arrive with a shared link.
 */
export function captureShareRef(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const current = new URLSearchParams(window.location.search).get('ref');
    if (!current) return readStoredShareRef();
    const code = current.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    if (!code) return null;
    localStorage.setItem(REF_KEY, code);
    localStorage.setItem(REF_AT_KEY, String(Date.now()));
    // Deliberately NOT rewriting the address bar: native history calls can
    // desync the Next.js router, and a re-shared URL still carries the same
    // code the arriving visitor already had (attribution stays honest either
    // way — the server validates every code before it ever counts).
    return code;
  } catch {
    return null;
  }
}

/** The stored share referrer code, honouring the TTL. Never throws. */
export function readStoredShareRef(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const code = localStorage.getItem(REF_KEY);
    if (!code || !/^[a-z0-9-]{1,40}$/.test(code)) return null;
    const at = Number(localStorage.getItem(REF_AT_KEY) || '0');
    if (!Number.isFinite(at) || Date.now() - at > REF_MAX_AGE_MS) {
      localStorage.removeItem(REF_KEY);
      localStorage.removeItem(REF_AT_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}
