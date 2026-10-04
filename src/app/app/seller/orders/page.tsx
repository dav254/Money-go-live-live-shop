'use client';

import * as React from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  EmptyState, OrderStatusPill, SellerCard, SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · ORDERS.
 *
 * Clone of `/dashboard/seller/orders`. The website renders a dense table with
 * inline actions; the app stacks one card per order with the status as a pill
 * and a filter rail across the top — the same data, the section's own layout.
 *
 * The query is always scoped to this seller: `firestore.rules` rejects a bare
 * `list()` on `orders`, so the filter is a hard requirement, not a preference.
 */

type OrderFilter = 'all' | 'pending' | 'processing' | 'completed';

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'New' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed', label: 'Done' },
];

const COMPLETED = ['delivered', 'shipped'];

export default function SellerSectionOrders() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = React.useState<OrderFilter>('all');

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const counts = React.useMemo(() => {
    const all = orders ?? [];
    return {
      all: all.length,
      pending: all.filter((o) => o.orderStatus === 'pending').length,
      processing: all.filter((o) => o.orderStatus === 'processing').length,
      completed: all.filter((o) => COMPLETED.includes(o.orderStatus)).length,
    };
  }, [orders]);

  const visible = React.useMemo(() => {
    const all = orders ?? [];
    switch (filter) {
      case 'pending':
        return all.filter((o) => o.orderStatus === 'pending');
      case 'processing':
        return all.filter((o) => o.orderStatus === 'processing');
      case 'completed':
        return all.filter((o) => COMPLETED.includes(o.orderStatus));
      default:
        return all;
    }
  }, [orders, filter]);

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <SellerSectionTitle eyebrow="Fulfilment" title="Orders" />

      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition',
              filter === chip.key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {chip.label} ({counts[chip.key]})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2.5 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="vn-skeleton h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filter === 'all' ? 'No orders yet' : 'Nothing here right now'}
          body="When a buyer checks out, the order appears here with its live status. Fulfil fast to earn repeat customers."
          action={
            <Link
              href="/app/seller"
              className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
            >
              Back to overview
            </Link>
          }
        />
      ) : (
        <div className="space-y-3 px-4">
          {visible.map((order) => (
            <article
              key={order.id}
              className="vn-app-card overflow-hidden rounded-2xl border border-border/80 bg-card"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {order.productName || 'Order'}
                    </p>
                    <OrderStatusPill status={order.orderStatus} />
                  </div>
                  <p className="font-grotesk mt-1.5 text-lg font-bold tabular-nums text-foreground">
                    ${order.totalAmount?.toFixed?.(2) ?? order.totalAmount}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    #{order.id.slice(0, 6).toUpperCase()}
                    {order.shippingCost ? ` · $${order.shippingCost} shipping` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/70 bg-secondary/40 px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {order.orderStatus === 'pending'
                    ? 'Confirm and pack promptly'
                    : order.orderStatus === 'processing'
                      ? 'On its way to the buyer'
                      : COMPLETED.includes(order.orderStatus)
                        ? 'Completed — funds cleared'
                        : String(order.orderStatus)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="px-4">
        <SellerCard className="vn-app-card bg-secondary/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Payout note
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Earnings are released when an order is marked delivered — 10% platform fee, 16% VAT,
            and 10% reseller commission where a reseller was involved. Everything lands in your
            wallet as a recorded transaction.
          </p>
        </SellerCard>
      </div>
    </div>
  );
}
