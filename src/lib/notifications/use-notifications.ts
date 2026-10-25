'use client';

/**
 * CLIENT NOTIFICATION HOOKS — live in-app updates over polling.
 *
 * ## Why polling
 *
 * Every read goes through the authenticated `/api/notifications` routes
 * (VPS-controlled storage behind them). Live updates use polling — the
 * VPS-supported method the spec allows — refreshed on an interval, when the
 * window regains focus, and when the tab becomes visible again (a phone
 * returning from the lock screen updates immediately). No WebSocket server,
 * no extra hosting cost, and a stale badge on a throttled background tab
 * recovers on the next interval or focus.
 *
 * ## Ownership
 *
 * The client never sends a userId: the API derives it from the verified ID
 * token. These hooks are a thin view over that API — nothing here decides
 * whose notifications are being read.
 *
 * ## Optimistic actions
 *
 * Mark-read / mark-all / dismiss update local state first so taps feel
 * instant, then reconcile with the server: a failed mutation re-fetches, so
 * the screen never lies about what the server believes.
 */

import * as React from 'react';
import { useUser } from '@/firebase';
import type { NormalizedNotification } from './normalize';

export type { NormalizedNotification };

const DEFAULT_POLL_MS = 30_000;

async function authHeaders(user: { getIdToken: () => Promise<string> }): Promise<HeadersInit> {
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface UseNotificationsOptions {
  /** How many notifications to load (server caps at 200). */
  limit?: number;
  /** Poll interval; 0 disables the interval (focus/visibility refresh still runs). */
  pollMs?: number;
}

/**
 * The signed-in user's notifications: list + total unread + mutations.
 * Returns an empty state while signed out — callers already guard on `user`.
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { limit = 50, pollMs = DEFAULT_POLL_MS } = options;
  const { user } = useUser();

  const [items, setItems] = React.useState<NormalizedNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notifications?limit=${limit}`, {
        headers: await authHeaders(user),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        items?: NormalizedNotification[];
        unread?: number;
      };
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnread(typeof data.unread === 'number' ? data.unread : 0);
      setError(null);
    } catch {
      setError('Could not load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [user, limit]);

  // Initial load + interval + return-to-tab refresh.
  React.useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);

    const timer = pollMs > 0 ? window.setInterval(() => void refresh(), pollMs) : undefined;
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) window.clearInterval(timer);
    };
  }, [user, refresh, pollMs]);

  /*
   * Optimistic mutations read the CURRENT items through a ref: setState
   * updaters do not run synchronously, so capturing "was this unread?" inside
   * an updater would be unreliable. The ref is refreshed every render.
   */
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const setRead = React.useCallback(
    async (id: string, isRead: boolean) => {
      if (!user) return;
      const target = itemsRef.current.find((n) => n.id === id);
      if (target && target.isRead !== isRead) {
        setItems((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead } : n)),
        );
        setUnread((u) => Math.max(0, u + (isRead ? -1 : 1)));
      }
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: await authHeaders(user),
          body: JSON.stringify({ isRead }),
        });
        if (!res.ok && res.status !== 404) throw new Error();
      } catch {
        await refresh();
      }
    },
    [user, refresh],
  );

  const markRead = React.useCallback(
    (id: string) => setRead(id, true),
    [setRead],
  );

  const markAllRead = React.useCallback(async () => {
    if (!user) return;
    setItems((prev) => prev.map((n) => (n.isRead ? n : { ...n, isRead: true })));
    setUnread(0);
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: await authHeaders(user),
      });
      if (!res.ok) throw new Error();
    } catch {
      await refresh();
    }
  }, [user, refresh]);

  const remove = React.useCallback(
    async (id: string) => {
      if (!user) return;
      const target = itemsRef.current.find((n) => n.id === id);
      if (target && !target.isRead) {
        setUnread((u) => Math.max(0, u - 1));
      }
      setItems((prev) => prev.filter((n) => n.id !== id));
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: await authHeaders(user),
        });
        if (!res.ok && res.status !== 404) throw new Error();
      } catch {
        await refresh();
      }
    },
    [user, refresh],
  );

  return {
    items,
    unread,
    isLoading,
    error,
    refresh,
    markRead,
    setRead,
    markAllRead,
    remove,
  };
}

/**
 * Just the badge number — cheaper than the full list, for headers that only
 * need a count. Same polling contract as `useNotifications`.
 */
export function useUnreadCount(pollMs = DEFAULT_POLL_MS) {
  const { user } = useUser();
  const [unread, setUnread] = React.useState(0);

  const refresh = React.useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications?count=unread', {
        headers: await authHeaders(user),
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { unread?: number };
      if (typeof data.unread === 'number') setUnread(data.unread);
    } catch {
      /* keep the last known count */
    }
  }, [user]);

  React.useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = pollMs > 0 ? window.setInterval(() => void refresh(), pollMs) : undefined;
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) window.clearInterval(timer);
    };
  }, [user, refresh, pollMs]);

  return { unread, refresh };
}