'use client';

/**
 * RequestsTeaser — "Customer requests" strip on the seller dashboard.
 * Surfaces active briefs (the matching-engine inbox) so sellers can act
 * without leaving the overview. Role-locked to sellers via SellerLayout.
 */

import * as React from 'react';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { fetchOpenRequests } from '@/lib/requests/client';
import type { MarketplaceRequest } from '@/lib/requests/types';
import { budgetLabel } from '@/lib/requests/labels';
import { Inbox, ArrowRight, MapPin, Loader2 } from 'lucide-react';

export function RequestsTeaser() {
  const { user } = useUser();
  const [rows, setRows] = React.useState<MarketplaceRequest[] | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchOpenRequests(user)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [user]);

  const loading = rows === null;
  const open = rows ?? [];

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-border pb-4 mb-2">
        <h2 className="font-grotesk text-xl font-bold text-foreground">Customer requests</h2>
        <Link
          href="/requests"
          className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition inline-flex items-center gap-1"
        >
          All requests <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading requests…
        </div>
      )}

      {!loading && open.length === 0 && (
        <div className="py-10 text-center">
          <Inbox className="mx-auto h-7 w-7 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No open briefs right now — new customer requests will appear here.
          </p>
        </div>
      )}

      {open.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {open.slice(0, 3).map((r) => (
            <Link
              key={r.id}
              href={`/requests/${r.id}`}
              className="group rounded-lg border border-border bg-card p-5 vn-transition hover:border-foreground/40 hover:bg-secondary"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {r.requestNumber || 'REQUEST'} · {r.category}
              </p>
              <p className="font-grotesk text-base font-bold text-foreground mt-2 line-clamp-1">{r.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{r.description}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="font-grotesk text-sm font-bold text-foreground">{budgetLabel(r)}</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground vn-transition">
                  {r.location && <><MapPin className="h-3 w-3" /> {r.location}</>}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
