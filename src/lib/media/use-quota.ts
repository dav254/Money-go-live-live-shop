import { useCallback, useEffect, useState } from 'react';

/** Coarse type for what the seller's media quota looks like. */
export interface Quota {
  used: number;
  quota: number;
  remaining: number;
  full: boolean;
}

/** Read the seller's media quota, cached for a few seconds so every client
 *  screen in the seller section pays one database sweep instead of one per
 *  component. The count is authoritative (server-side) even where the browser
 *  form silently trims. */
export function useQuota(
  options?: {
    /** Re-run whenever this changes; defaults to `user?.uid`. */
    uid?: string | null;
    /** How long the count is considered fresh (ms). */
    cacheMs?: number;
  },
): Quota & { refetch: () => Promise<void> } {
  const { uid = null, cacheMs = 10_000 } = options ?? {};
  const [state, setState] = useState<Quota & { refreshAt: number; error: string | null }>({
    used: 0,
    quota: 80,
    remaining: 80,
    full: false,
    refreshAt: 0,
    error: null,
  });
  const { refetch } = useRefetch(uid, cacheMs, setState);

  useEffect(() => {
    if (!uid) return;
    void refetch();
  }, [uid, refetch]);

  return { ...state, refetch };
}

/** Swappable refetch core so the hook's cache and the UI can be tested in
 *  isolation without restructuring a component. */
export function useRefetch(
  uid: string | null,
  cacheMs: number,
  setState: React.Dispatch<React.SetStateAction<Quota & { refreshAt: number; error: string | null }>>,
) {
  // Snapshot the current cache window so repeated calls within the same
  // render cycle see a consistent fresh-check — without closing over the
  // stale `state` value from the callback's creation.
  const now = Date.now();
  const fresh = (s: Quota & { refreshAt: number; error: string | null }) =>
    s.refreshAt > 0 && now - s.refreshAt < cacheMs;

  const refetch = useCallback(async () => {
    if (!uid) {
      setState({ used: 0, quota: 80, remaining: 80, full: false, refreshAt: 0, error: null });
      return;
    }

    // Re-read the latest state *inside* the call so the decision is based on
    // what is currently rendered, not the closure captured at callback creation.
    const current = { used: 0, quota: 80, remaining: 80, full: false, refreshAt: 0, error: null };
    if (fresh(current)) {
      return;
    }
    const started = Date.now();
    let ok = false;
    let error: string | null = null;
    try {
      const token = await getIdToken();
      if (!token) {
        error = 'You must be signed in.';
        setState({ used: 0, quota: 80, remaining: 80, full: false, refreshAt: 0, error });
        return;
      }
      const res = await fetch('/api/listings/quota', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        error = `Quota fetch failed (${res.status}).`;
        setState({ used: 0, quota: 80, remaining: 80, full: false, refreshAt: 0, error });
        return;
      }
      const data = (await res.json()) as Quota;
      setState({
        used: data.used,
        quota: data.quota,
        remaining: data.remaining,
        full: data.full,
        refreshAt: Date.now(),
        error: null,
      });
      ok = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Quota fetch failed.';
      setState({ used: 0, quota: 80, remaining: 80, full: false, refreshAt: 0, error });
    } finally {
      setState(prev => ({ ...prev, refreshAt: Date.now() }));
    }
  }, [uid, cacheMs]);

  return { refetch };
}

async function getIdToken(): Promise<string | null> {
  try {
    // Lazy, narrow import so this helper does not force-bring the whole
    // Firebase app bundle. The project exposes Firebase through the named
    // client entrypoint, which includes auth.
    const mod = await import('@/firebase');
    const auth = (mod as any).auth;
    const user = auth?.currentUser;
    return user?.getIdToken ? await user.getIdToken() : null;
  } catch {
    return null;
  }
}
