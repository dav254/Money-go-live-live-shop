'use client';

import * as React from 'react';
import Link from 'next/link';
import { CreditCard, MessageSquare, Package, Truck } from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  BuyerEmptyState, BuyerSectionTitle, BuyerStatusPill,
} from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · ORDERS.
 *
 * Clone of `/buyer/my-orders`. The website uses a tabbed table with dialogs;
 * the app uses a filter rail over stacked cards. Same `orders` collection, and
 * the query is always filtered on `buyerId == uid` because `firestore.rules`
 * forbids a bare list over `orders`.
 */

type OrderFilter = 'all' | 'pending' | 'active' | 'done';

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pay' },
  { key: 'active', label: 'On the way' },
  { key: 'done', label: 'Delivered' },
];

const ACTIVE = ['processing', 'packed', 'shipped', 'paid'];
const DONE = ['delivered'];

function formatDate(value: unknown): string {
  const ts =
    value && typeof value === 'object' && 'toDate' in (value as { toDate?: unknown })
      ? (value as { toDate: () => Date }).toDate()
      : value instanceof Date
        ? value
        : null;
  return ts ? ts.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}

export default function BuyerSectionOrders() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = React.useState<OrderFilter>('all');

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid), limit(50));
  }, [firestore, user]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const counts = React.useMemo(() => {
    const all = orders ?? [];
    return {
      all: all.length,
      pending: all.filter((o) => o.orderStatus === 'pending').length,
      active: all.filter((o) => ACTIVE.includes(o.orderStatus)).length,
      done: all.filter((o) => DONE.includes(o.orderStatus)).length,
    };
  }, [orders]);

  const visible = React.useMemo(() => {
    const all = orders ?? [];
    switch (filter) {
      case 'pending':
        return all.filter((o) => o.orderStatus === 'pending');
      case 'active':
        return all.filter((o) => ACTIVE.includes(o.orderStatus));
      case 'done':
        return all.filter((o) => DONE.includes(o.orderStatus));
      default:
        return all;
    }
  }, [orders, filter]);

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle eyebrow="Delivery" title="My orders" />

      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-wider transition',
              filter === chip.key
                ? 'bg-gradient-to-r from-cyan-400 to-violet-500 text-white shadow-md shadow-violet-500/25'
                : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground',
            )}
          >
            {chip.label} ({counts[chip.key]})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3 px-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="vn-skeleton h-28 w-full rounded-3xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <BuyerEmptyState
          icon={Package}
          title={filter === 'all' ? 'No orders yet' : 'Nothing in this filter'}
          body="Orders you place show up here with live status, tracking and a direct line to the seller."
          action={
            <Link
              href="/app/buyer/shop"
              className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-semibold text-white"
            >
              Shop the marketplace
            </Link>
          }
        />
      ) : (
        <div className="space-y-3 px-4">
          {visible.map((order) => {
            const needsPayment = order.orderStatus === 'pending';
            const isDone = DONE.includes(order.orderStatus);

            return (
              <article key={order.id} className="vn-buyer-card overflow-hidden p-0">
                <div className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-600 dark:text-cyan-300">
                    <Package className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-foreground">
                        {order.productName || 'Order'}
                      </p>
                      <BuyerStatusPill status={order.orderStatus} />
                    </div>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                      ${order.totalAmount?.toFixed?.(2) ?? order.totalAmount}
                    </p>
                    <p className="vn-micro mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      #{order.id.slice(0, 6).toUpperCase()}
                      {formatDate(order.orderDate) ? ` · ${formatDate(order.orderDate)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-secondary/40 px-4 py-2.5">
                  <span className="vn-micro flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {isDone ? (
                      <>
                        <Truck className="h-3 w-3" /> Delivered
                      </>
                    ) : needsPayment ? (
                      <>
                        <CreditCard className="h-3 w-3" /> Payment pending
                      </>
                    ) : (
                      <>
                        <Truck className="h-3 w-3" /> On its way
                      </>
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/buyer/messages?chatWith=${encodeURIComponent(order.sellerId)}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-border transition hover:text-foreground"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Seller
                    </Link>
                    {needsPayment && (
                      <Link
                        href={`/app/buyer/checkout/${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-white"
                      >
                        <CreditCard className="h-3 w-3" />
                        Pay now
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
