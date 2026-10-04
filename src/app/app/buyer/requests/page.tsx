'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarDays, Eye, Loader2, MapPin, MessageSquareText, Plus, Sparkles,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { fetchMyRequests } from '@/lib/requests/client';
import type { MarketplaceRequest } from '@/lib/requests/types';
import { budgetLabel } from '@/lib/requests/labels';
import { StatusBadge } from '@/app/buyer/requests/status-badge';
import {
  BuyerEmptyState, BuyerSectionTitle,
} from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · REQUEST MARKETPLACE.
 *
 * Clone of `/buyer/requests`: same `fetchMyRequests` client, same status badge,
 * same budget labelling, same "post a request" destination. The website lays
 * these out as bordered cards in a single column with a header button; the app
 * turns the header into the section's own band-less title block and floats the
 * compose action into the content flow, where a thumb can reach it.
 */
export default function BuyerSectionRequests() {
  const { user, isLoading: authLoading } = useUser();
  const [requests, setRequests] = React.useState<MarketplaceRequest[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMyRequests(user)
      .then((rows) => alive && setRequests(rows))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Failed to load'));
    return () => {
      alive = false;
    };
  }, [user]);

  const loading = authLoading || (!requests && !error);

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="Request Marketplace"
        title="My requests"
        action={
          <Link
            href="/app/buyer/requests"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-2 font-sans text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-violet-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Link>
        }
      />

      <p className="-mt-2 px-4 font-sans text-xs leading-relaxed text-muted-foreground">
        Post what you need — with photos or a short video — and let matched businesses come to
        you with offers.
      </p>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="font-sans text-sm">Loading your requests…</span>
        </div>
      )}

      {error && (
        <p className="mx-4 rounded-2xl bg-destructive/10 px-4 py-3 font-sans text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {!loading && requests?.length === 0 && (
        <BuyerEmptyState
          icon={Sparkles}
          title="No requests yet"
          body="Describe the product or service you need and sellers compete to fulfil it — you pick the best offer."
          action={
            <Link
              href="/app/buyer/requests"
              className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-semibold text-white"
            >
              Post your first request
            </Link>
          }
        />
      )}

      <div className="space-y-3 px-4">
        {(requests ?? []).map((r) => (
          <article key={r.id} className="vn-buyer-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
                  {r.requestNumber || r.category}
                </p>
                <h2 className="mt-1 text-base font-semibold leading-snug text-foreground">
                  {r.title}
                </h2>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <p className="mt-2 line-clamp-2 font-sans text-xs leading-relaxed text-muted-foreground">
              {r.description}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-[11px] text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">
                {budgetLabel(r)}
              </span>
              {r.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {r.location}
                </span>
              )}
              {r.deadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(r.deadline).toLocaleDateString()}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {r.views ?? 0}
              </span>
            </div>

            <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-3">
              <span className="vn-micro text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {r.offersCount} offer{r.offersCount === 1 ? '' : 's'} received
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href="/app/buyer/requests"
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-border transition hover:text-foreground"
                >
                  <MessageSquareText className="h-3 w-3" />
                  Offers
                </Link>
                <Link
                  href="/app/buyer/requests"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-white"
                >
                  Review
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
