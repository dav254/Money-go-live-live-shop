import { useEffect, useState } from 'react';

import { commerce, notifications } from './api';
import { useAuth } from './auth';

/**
 * NAVIGATION COUNTS — the numbers behind the drawer badges.
 *
 * Every value here comes from the server that already owns it:
 *
 *   • `unread`   — `GET /api/notifications?count=unread`, the same call the
 *                  header bell has always used.
 *   • `orders`   — buyer orders the server itself flags `canReview` (finished,
 *                  not yet reviewed): the one order action a buyer can take.
 *   • `requests` — the buyer's own briefs still collecting offers.
 *   • `sellerOrders` — the seller's orders that are not yet delivered or
 *                  cancelled, i.e. work the seller actually has to do.
 *
 * A failed request leaves the previous number in place rather than flashing a
 * wrong one; a badge is decoration and must never break a screen.
 */
export type NavCounts = {
  unread: number;
  orders: number;
  requests: number;
  sellerOrders: number;
};

const EMPTY: NavCounts = { unread: 0, orders: 0, requests: 0, sellerOrders: 0 };

const DONE = new Set(['delivered', 'completed', 'cancelled', 'canceled', 'refunded']);

export function useNavCounts(intervalMs = 60_000): NavCounts {
  const { status, getToken, canSell } = useAuth();
  const [counts, setCounts] = useState<NavCounts>(EMPTY);

  useEffect(() => {
    if (status !== 'signedIn') {
      setCounts(EMPTY);
      return;
    }
    let alive = true;

    const load = async () => {
      try {
        const token = await getToken();

        const [unread, orders, requests, sellerOrders] = await Promise.allSettled([
          notifications.unread(token),
          commerce.buyerOrders(token),
          commerce.myRequests(token),
          canSell ? commerce.sellerOrders(token) : Promise.resolve([]),
        ]);

        if (!alive) return;

        const next: NavCounts = { ...EMPTY };

        if (unread.status === 'fulfilled') next.unread = Number(unread.value?.unread ?? 0) || 0;

        if (orders.status === 'fulfilled') {
          const list = (orders.value?.orders ?? []) as Array<{ canReview?: boolean }>;
          next.orders = list.filter((order) => order?.canReview).length;
        }

        if (requests.status === 'fulfilled') {
          const list = (requests.value?.requests ?? []) as Array<{ status?: string }>;
          next.requests = list.filter((row) => {
            const state = String(row?.status ?? '').toLowerCase();
            return state === 'open' || state === 'pending' || state === 'active';
          }).length;
        }

        if (sellerOrders.status === 'fulfilled') {
          const list = (Array.isArray(sellerOrders.value) ? sellerOrders.value : []) as Array<{
            status?: string;
          }>;
          next.sellerOrders = list.filter(
            (order) => !DONE.has(String(order?.status ?? '').toLowerCase()),
          ).length;
        }

        setCounts(next);
      } catch {
        // Keep whatever we showed last time.
      }
    };

    load();
    const timer = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [status, getToken, canSell, intervalMs]);

  return counts;
}
