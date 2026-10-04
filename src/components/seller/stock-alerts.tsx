'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SellerProduct = Product & { id: string };

/** At or below this count a product is "running low". */
const LOW_STOCK_THRESHOLD = 3;

/**
 * Inventory attention strip. Renders nothing when every product is healthy, so
 * the dashboard stays quiet for sellers who don't need to restock.
 */
export function StockAlerts({ products, isLoading }: { products?: SellerProduct[] | null; isLoading?: boolean }) {
  if (isLoading) return null;

  const list = products ?? [];
  const outOfStock = list.filter((p) => (p.stock ?? 0) <= 0);
  const lowStock = list.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD);

  const total = outOfStock.length + lowStock.length;
  if (total === 0) return null;

  const headline = outOfStock.length
    ? `${outOfStock.length} product${outOfStock.length === 1 ? '' : 's'} out of stock`
    : `${lowStock.length} product${lowStock.length === 1 ? '' : 's'} running low`;
  const detail = outOfStock.length
    ? 'Buyers can’t order these until you restock — that’s lost revenue on your most-viewed listings.'
    : `Fewer than ${LOW_STOCK_THRESHOLD + 1} units left. Restock before a promotion or a live stream.`;

  const chips = [
    ...outOfStock.slice(0, 3).map((p) => ({ id: p.id, name: p.name, stock: 0 })),
    ...lowStock.slice(0, Math.max(0, 4 - outOfStock.slice(0, 3).length)).map((p) => ({ id: p.id, name: p.name, stock: p.stock ?? 0 })),
  ];

  return (
    <section
      className={cn(
        'rounded-lg border px-5 py-4',
        outOfStock.length ? 'border-destructive/40 bg-destructive/5' : 'border-accent/40 bg-accent/5',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground inline-flex items-center gap-2">
            <AlertTriangle className={cn('h-3.5 w-3.5', outOfStock.length ? 'text-destructive' : 'text-accent')} />
            {headline}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{detail}</p>
        </div>
        <Button asChild variant="outline" className="h-10 rounded-lg text-[10px] font-semibold uppercase tracking-[0.18em]">
          <Link href="/dashboard/products">
            Manage inventory <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {chips.map((chip) => (
            <Link
              key={chip.id}
              href="/dashboard/products"
              className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground hover:border-foreground/35 vn-transition"
            >
              {chip.name}
              <span className={cn('ml-2 tabular-nums', chip.stock === 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {chip.stock === 0 ? 'out of stock' : `${chip.stock} left`}
              </span>
            </Link>
          ))}
          {total > chips.length && (
            <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
              +{total - chips.length} more
            </span>
          )}
        </div>
      )}
    </section>
  );
}