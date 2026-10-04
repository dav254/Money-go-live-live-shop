'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, PackageCheck, Truck } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

/** The happy path a buyer watches: paid → packed → on the way → delivered. */
const TRACKING_STEPS: { key: string; label: string }[] = [
  { key: 'processing', label: 'Paid' },
  { key: 'shipped', label: 'Packed' },
  { key: 'delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
];

const STEP_RANK: Record<string, number> = {
  pending: -1,
  processing: 0,
  shipped: 1,
  delivery: 2,
  delivered: 3,
  cancelled: -2,
  disputed: -2,
  refunded: -2,
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Payment awaiting',
  processing: 'Payment verified',
  shipped: 'In transit',
  delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
  refunded: 'Refunded',
};

function toMillis(value: unknown): number {
  if (!value) return NaN;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  const maybe = value as { toMillis?: () => number; seconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return NaN;
}

export function RecentOrdersWidget() {
  const { user } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid));
  }, [user, firestore]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const recent = React.useMemo(() => {
    const list = orders ?? [];
    return [...list]
      .sort((a, b) => {
        const at = toMillis(a.orderDate);
        const bt = toMillis(b.orderDate);
        return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
      })
      .slice(0, 3);
  }, [orders]);

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border pb-4 mb-2">
        <h2 className="font-grotesk text-xl font-bold text-foreground">Your recent orders</h2>
        <Link
          href="/buyer/my-orders"
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition inline-flex items-center gap-1"
        >
          Track all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading && recent.length === 0 ? (
        <div className="space-y-3 py-2">
          {[0, 1].map((i) => (
            <div key={i} className="border-b border-border py-4 space-y-3">
              <Skeleton className="vn-skeleton h-4 w-1/3" />
              <Skeleton className="vn-skeleton h-2 w-full" />
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-grotesk text-base font-semibold text-foreground">No orders yet</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            Your purchases and their delivery progress will show up here.
          </p>
          <Link
            href="/search"
            className="inline-block mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground underline underline-offset-4"
          >
            Start exploring
          </Link>
        </div>
      ) : (
        <div>
          {recent.map((order) => {
            const rank = STEP_RANK[order.orderStatus] ?? -1;
            const trackable = rank >= 0;
            return (
              <div key={order.id} className="py-4 border-b border-border">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                    <Image
                      src={order.productImage || 'https://placehold.co/80x80/141414/FFFFFF?text=—'}
                      fill
                      alt={order.productName || 'Order item'}
                      onError={(event) => {
                        const el = event.currentTarget;
                        if (el.dataset.fallbackApplied === 'true') return;
                        el.dataset.fallbackApplied = 'true';
                        el.src = getPlaceholderImage();
                      }}
                      className="object-cover vn-mono-img"
                      sizes="48px"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{order.productName || 'Order item'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {STATUS_LABEL[order.orderStatus] ?? order.orderStatus}
                      {order.trackingNumber ? ` · ${order.courierName || 'Tracking'}: ${order.trackingNumber}` : ''}
                    </p>
                  </div>

                  <p className="font-grotesk text-base font-bold tabular-nums text-foreground">
                    ${(order.totalAmount ?? 0).toLocaleString()}
                  </p>

                  <Link
                    href="/buyer/my-orders"
                    className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground vn-transition"
                  >
                    Details
                  </Link>
                </div>

                {trackable && (
                  <div className="mt-3 pl-0 sm:pl-16">
                    <div className="flex items-center gap-1.5">
                      {TRACKING_STEPS.map((step, index) => {
                        const done = rank >= index;
                        const isCurrent = rank === index;
                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex flex-col items-center gap-1 min-w-[3.5rem]">
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  done ? 'bg-foreground' : 'bg-border',
                                  isCurrent && 'ring-2 ring-foreground/25',
                                )}
                              />
                              <span
                                className={cn(
                                  'text-[9px] font-semibold uppercase tracking-[0.15em] whitespace-nowrap',
                                  done ? 'text-foreground' : 'text-muted-foreground/60',
                                )}
                              >
                                {step.label}
                              </span>
                            </div>
                            {index < TRACKING_STEPS.length - 1 && (
                              <div className={cn('h-px flex-1 -mt-4', rank > index ? 'bg-foreground/60' : 'bg-border')} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    {rank >= 1 && rank < 3 && (
                      <p className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                        <Truck className="h-3 w-3" />
                        {rank === 1 ? 'Your order is on its way.' : 'Out for delivery today.'}
                      </p>
                    )}
                    {rank >= 3 && (
                      <p className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                        <PackageCheck className="h-3 w-3" />
                        Delivered{order.deliveredAt ? ` · ${new Date(toMillis(order.deliveredAt)).toLocaleDateString()}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}