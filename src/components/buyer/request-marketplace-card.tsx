'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList, Megaphone, Sparkles } from 'lucide-react';
import { useUser } from '@/firebase';
import { fetchMyRequests } from '@/lib/requests/client';
import type { MarketplaceRequest } from '@/lib/requests/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Request Marketplace entry point.
 *
 * Buyers had no path to the marketplace from their dashboard — the whole
 * "describe what you need and let businesses bid" loop was sidebar-only.
 */
export function RequestMarketplaceCard() {
  const { user } = useUser();
  const [requests, setRequests] = React.useState<MarketplaceRequest[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    let alive = true;
    setIsLoading(true);
    fetchMyRequests(user)
      .then((rows) => {
        if (alive) setRequests(rows);
      })
      .catch(() => {
        if (alive) setRequests([]);
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const active = (requests ?? []).filter((r) => r.status === 'active');
  const offers = active.reduce((sum, r) => sum + (r.offersCount ?? 0), 0);
  const awaitingDecision = active.filter((r) => (r.offersCount ?? 0) > 0 && !r.acceptedOfferId).length;

  return (
    <section className="rounded-lg border border-border bg-card p-6 lg:p-7">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground inline-flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5" /> Request Marketplace
          </p>
          <h2 className="font-grotesk text-xl lg:text-2xl font-bold text-foreground mt-3">
            Describe what you need. Let businesses compete for it.
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Post a request with your budget and media, and verified sellers send you offers you can compare and accept.
          </p>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href="/buyer/post-request"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-foreground px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-background vn-transition hover:bg-foreground/90"
          >
            Post a request
          </Link>
          <Link
            href="/buyer/requests"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground vn-transition hover:border-foreground/40"
          >
            My requests
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden mt-6">
        {[
          { label: 'Active requests', value: isLoading ? null : String(active.length) },
          { label: 'Offers received', value: isLoading ? null : String(offers) },
          { label: 'Awaiting your decision', value: isLoading ? null : String(awaitingDecision) },
        ].map((stat) => (
          <div key={stat.label} className="bg-card px-4 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{stat.label}</p>
            {stat.value === null ? (
              <Skeleton className="vn-skeleton h-7 w-10 mt-2" />
            ) : (
              <p className="font-grotesk text-2xl font-bold mt-1.5 tabular-nums">{stat.value}</p>
            )}
          </div>
        ))}
      </div>

      {!isLoading && active.length > 0 && (
        <ul className="mt-5 space-y-2">
          {active.slice(0, 2).map((request) => (
            <li key={request.id}>
              <Link
                href={`/requests/${request.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 vn-transition',
                  'hover:border-foreground/35',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">{request.title}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    {request.category}
                    {request.offersCount ? ` · ${request.offersCount} offer${request.offersCount === 1 ? '' : 's'}` : ' · waiting for offers'}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {(request.offersCount ?? 0) > 0 && !request.acceptedOfferId && (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-foreground">
                      Review
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && active.length === 0 && (
        <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          You have no active requests. Post one and sellers will start bidding within minutes.
        </p>
      )}

      {!isLoading && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          <Link href="/ai-studio" className="inline-flex items-center gap-2 hover:text-foreground vn-transition">
            <Sparkles className="h-3 w-3" />
            Need artwork or a concept first? Create one in AI Studio and attach it to your request.
          </Link>
        </p>
      )}
    </section>
  );
}