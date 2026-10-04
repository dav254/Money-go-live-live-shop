'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import type { Order, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type SellerOrder = Order & { id: string };

const COUNTED_STATUSES = ['processing', 'shipped', 'delivery', 'delivered'];

/** Firestore Timestamps, ISO strings and epoch numbers all show up on orders. */
function toMillis(value: unknown): number {
  if (!value) return NaN;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  const maybe = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  if (typeof maybe._seconds === 'number') return maybe._seconds * 1000;
  return NaN;
}

const currency = (value: number) =>
  value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function sumRevenue(list: SellerOrder[], from: number, to: number): number {
  return list.reduce((sum, order) => {
    if (!COUNTED_STATUSES.includes(order.orderStatus)) return sum;
    const at = toMillis(order.orderDate);
    if (Number.isNaN(at) || at < from || at > to) return sum;
    return sum + (order.totalAmount ?? 0);
  }, 0);
}

export function AnalyticsSnapshot({
  orders,
  products,
  isLoading,
}: {
  orders?: SellerOrder[] | null;
  products?: (Product & { id: string })[] | null;
  isLoading?: boolean;
}) {
  const [days, setDays] = React.useState<7 | 30>(7);

  const stats = React.useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(new Date().toDateString()).getTime();
    const periodStart = startOfToday - (days - 1) * dayMs;
    const previousStart = periodStart - days * dayMs;

    const all = orders ?? [];
    const inRange = (from: number) =>
      all.filter((order) => {
        const at = toMillis(order.orderDate);
        return !Number.isNaN(at) && at >= from && at <= now && COUNTED_STATUSES.includes(order.orderStatus);
      });

    const current = inRange(periodStart);
    const previous = all.filter((order) => {
      const at = toMillis(order.orderDate);
      return !Number.isNaN(at) && at >= previousStart && at < periodStart && COUNTED_STATUSES.includes(order.orderStatus);
    });

    const revenue = current.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
    const previousRevenue = previous.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
    const orderCount = current.length;
    const aov = orderCount ? revenue / orderCount : 0;
    const views = (products ?? []).reduce((sum, product) => sum + (product.viewCount || 0), 0);
    const conversion = views > 0 ? (orderCount / views) * 100 : 0;

    // Daily revenue buckets for the sparkline.
    const buckets: { label: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const dayStart = startOfToday - i * dayMs;
      const dayEnd = dayStart + dayMs;
      buckets.push({
        label: new Date(dayStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        value: sumRevenue(all, dayStart, dayEnd),
      });
    }

    return {
      revenue,
      previousRevenue,
      delta: previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null,
      orderCount,
      aov,
      conversion,
      buckets,
    };
  }, [orders, products, days]);

  const peak = Math.max(...stats.buckets.map((b) => b.value), 1);

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border pb-4 mb-5">
        <h2 className="font-grotesk text-xl font-bold text-foreground">Performance</h2>
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg border border-border p-0.5">
            {([7, 30] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={cn(
                  'rounded-md px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] vn-transition',
                  days === option ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option}d
              </button>
            ))}
          </div>
          <Link
            href="/dashboard/seller/analytics"
            className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition"
          >
            Analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card p-5">
              <Skeleton className="vn-skeleton h-3 w-20" />
              <Skeleton className="vn-skeleton h-7 w-24 mt-3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden">
          <div className="bg-card p-5 lg:p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Revenue</p>
            <p className="font-grotesk text-2xl lg:text-3xl font-bold mt-2 tabular-nums">{currency(stats.revenue)}</p>
            {stats.delta !== null && (
              <p
                className={cn(
                  'mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em]',
                  stats.delta >= 0 ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {stats.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {stats.delta >= 0 ? '+' : ''}
                {stats.delta.toFixed(0)}% vs prev {days}d
              </p>
            )}
          </div>
          <div className="bg-card p-5 lg:p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Orders</p>
            <p className="font-grotesk text-2xl lg:text-3xl font-bold mt-2 tabular-nums">{stats.orderCount}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">last {days} days</p>
          </div>
          <div className="bg-card p-5 lg:p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Average order</p>
            <p className="font-grotesk text-2xl lg:text-3xl font-bold mt-2 tabular-nums">{currency(stats.aov)}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">per paid order</p>
          </div>
          <div className="bg-card p-5 lg:p-6">
            <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Conversion</p>
            <p className="font-grotesk text-2xl lg:text-3xl font-bold mt-2 tabular-nums">{stats.conversion.toFixed(1)}%</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">orders ÷ views</p>
          </div>

          <div className="bg-card p-5 lg:p-6 col-span-2 lg:col-span-4">
            <div className="flex items-end gap-1 h-16" role="img" aria-label={`Revenue trend over the last ${days} days`}>
              {stats.buckets.map((bucket, index) => (
                <div key={`${bucket.label}-${index}`} className="flex-1 flex flex-col justify-end h-full group" title={`${bucket.label}: ${currency(bucket.value)}`}>
                  <div
                    className="w-full bg-foreground/15 group-hover:bg-foreground/35 vn-transition rounded-t-[2px]"
                    style={{ height: `${Math.max((bucket.value / peak) * 100, bucket.value > 0 ? 6 : 2)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <span>{stats.buckets[0]?.label}</span>
              <span>{stats.buckets[stats.buckets.length - 1]?.label}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}