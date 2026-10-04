'use client';

import * as React from 'react';

/**
 * RECENTLY VIEWED — a local, per-device history.
 *
 * ## Why localStorage and not Firestore
 *
 * A "recently viewed" list is a convenience cache for one person on one phone.
 * Writing it to Firestore would mean a collection, a rule, an index and a
 * privacy story for data the user would delete by clearing site data anyway. It
 * is stored locally, capped, and survives navigation but not reinstall — which
 * is exactly the behaviour people expect from a shopping app.
 *
 * ## Why it is a hook and not a raw read
 *
 * Two traps this avoids:
 *
 * 1. **SSR.** `localStorage` does not exist during the server render, so the
 *    initial state is always empty and the list fills in after mount. Reading it
 *    during render would throw a hydration mismatch.
 * 2. **Same-tab recording.** `storage` events fire only in *other* tabs, so a
 *    write from the feed would never refresh an open list. This dispatches a
 *    custom event on `window` and every mounted hook listens for it.
 */

/** Most-recent-first, most-recent-last semantics handled by unshift. */
export const RECENTLY_VIEWED_KEY = 'vidnov.buyer.recentlyViewed';

/** Keep the list short — this is a convenience rail, not an archive. */
export const RECENTLY_VIEWED_LIMIT = 24;

export interface RecentProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  /** Epoch ms of the most recent sighting. */
  seenAt: number;
}

/** Fired on `window` after a write so every open list updates at once. */
const RECENTLY_VIEWED_EVENT = 'vidnov:recently-viewed';

function isRecentProduct(value: unknown): value is RecentProduct {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && v.id.length > 0 && typeof v.name === 'string';
}

/** Read the stored list. Never throws — a corrupt value yields an empty list. */
export function readRecentlyViewed(): RecentProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentProduct).slice(0, RECENTLY_VIEWED_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Record a sighting, moving an already-seen product back to the front.
 * No-ops on the server and on a storage failure (private mode, quota).
 */
export function recordRecentlyViewed(product: {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}): void {
  if (typeof window === 'undefined') return;
  if (!product?.id) return;

  try {
    const next: RecentProduct = {
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      imageUrl: product.imageUrl,
      seenAt: Date.now(),
    };

    const existing = readRecentlyViewed().filter((p) => p.id !== next.id);
    const list = [next, ...existing].slice(0, RECENTLY_VIEWED_LIMIT);

    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT));
  } catch {
    // Storage unavailable — the feed must not break because of a convenience list.
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(RECENTLY_VIEWED_KEY);
    window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT));
  } catch {
    // Nothing to do.
  }
}

/** Reactive view of the list, kept in sync across tabs via the `storage` event. */
export function useRecentlyViewed(): { items: RecentProduct[]; ready: boolean } {
  const [items, setItems] = React.useState<RecentProduct[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      setItems(readRecentlyViewed());
      setReady(true);
    };

    sync();
    window.addEventListener(RECENTLY_VIEWED_EVENT, sync);
    // Other tabs writing the same key.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RECENTLY_VIEWED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { items, ready };
}

/**
 * Record a product once it has actually been *seen* — at least half visible for
 * a moment — rather than merely mounted. Mounting records every card in the
 * feed the instant the page opens, which is not what "recently viewed" means.
 */
export function useRecordOnScreen(
  product: { id: string; name: string; price: number; imageUrl?: string } | null,
  ref: React.RefObject<HTMLElement | null>,
): void {
  const recordedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!product?.id || !node || recordedRef.current === product.id) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timer) return;
          timer = setTimeout(() => {
            // Re-read: the feed may have scrolled on during the dwell.
            if (recordedRef.current !== product.id) {
              recordRecentlyViewed(product);
              recordedRef.current = product.id;
            }
          }, 1500);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 1] },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [product, ref]);
}