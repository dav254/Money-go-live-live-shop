'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Loader2, Package, Truck, CheckCircle2, XCircle } from 'lucide-react';
import type { Order } from '@/lib/types';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type SellerOrder = Order & { id: string };

const STATUS_META: Record<string, { label: string; dot: string }> = {
  pending: { label: 'Awaiting payment', dot: 'vn-dot-pending' },
  processing: { label: 'Payment verified', dot: 'vn-dot-completed' },
  shipped: { label: 'In transit', dot: 'vn-dot-completed' },
  delivery: { label: 'Out for delivery', dot: 'vn-dot-completed' },
  delivered: { label: 'Delivered', dot: 'vn-dot-completed' },
  cancelled: { label: 'Cancelled', dot: 'vn-dot-failed' },
  disputed: { label: 'Disputed', dot: 'vn-dot-failed' },
  refunded: { label: 'Refunded', dot: 'vn-dot-failed' },
};

/** The single most useful next step for an order, if there is one. */
function nextAction(order: SellerOrder): { status: Order['orderStatus']; label: string; icon: typeof Package } | null {
  switch (order.orderStatus) {
    case 'pending':
      return { status: 'processing', label: 'Confirm payment', icon: CheckCircle2 };
    case 'processing':
      return { status: 'shipped', label: 'Mark shipped', icon: Truck };
    case 'shipped':
      return { status: 'delivered', label: 'Mark delivered', icon: Package };
    default:
      return null;
  }
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  const date =
    typeof value === 'object' && value !== null && 'toDate' in (value as { toDate?: () => Date })
      ? (value as { toDate: () => Date }).toDate()
      : new Date(value as string);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function RecentOrdersWidget({
  orders,
  isLoading,
}: {
  orders?: SellerOrder[] | null;
  isLoading?: boolean;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const recent = React.useMemo(() => {
    const list = orders ?? [];
    return [...list]
      .sort((a, b) => {
        const at = a.orderDate?.toMillis?.() ?? new Date(a.orderDate ?? 0).getTime();
        const bt = b.orderDate?.toMillis?.() ?? new Date(b.orderDate ?? 0).getTime();
        return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
      })
      .slice(0, 5);
  }, [orders]);

  const updateStatus = async (order: SellerOrder, status: Order['orderStatus']) => {
    if (!user) return;
    setBusyId(order.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/seller/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Could not update the order.');
      toast({ title: `Order ${STATUS_META[status]?.label ?? status}` });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border pb-4 mb-2">
        <h2 className="font-grotesk text-xl font-bold text-foreground">Recent orders</h2>
        <Link
          href="/dashboard/seller/orders"
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition inline-flex items-center gap-1"
        >
          All orders <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading && recent.length === 0 ? (
        <div className="space-y-3 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border py-4">
              <Skeleton className="vn-skeleton h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="vn-skeleton h-4 w-1/2" />
                <Skeleton className="vn-skeleton h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-grotesk text-base font-semibold text-foreground">No orders yet</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            When a customer buys one of your products it will appear here.
          </p>
        </div>
      ) : (
        <div>
          {recent.map((order) => {
            const meta = STATUS_META[order.orderStatus] ?? { label: order.orderStatus, dot: '' };
            const action = nextAction(order);
            const cancellable = order.orderStatus === 'pending' || order.orderStatus === 'processing';
            const busy = busyId === order.id;
            return (
              <div key={order.id} className="flex flex-wrap items-center gap-4 py-4 border-b border-border">
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
                    {formatDate(order.orderDate)} · {order.quantity ?? 1} × ${(order.productPrice ?? 0).toLocaleString()}
                  </p>
                </div>

                <p className="font-grotesk text-base font-bold tabular-nums text-foreground">
                  ${(order.totalAmount ?? 0).toLocaleString()}
                </p>

                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground min-w-[9.5rem]">
                  <span className={cn('vn-dot', meta.dot)} />
                  <span className="truncate">{meta.label}</span>
                </span>

                <div className="flex items-center gap-2">
                  {action && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-9"
                      disabled={busy}
                      onClick={() => updateStatus(order, action.status)}
                    >
                      {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <action.icon className="mr-2 h-3.5 w-3.5" />}
                      {action.label}
                    </Button>
                  )}
                  {cancellable && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Cancel order"
                      title="Cancel order"
                      className="h-9 w-9 rounded-lg text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => updateStatus(order, 'cancelled')}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}