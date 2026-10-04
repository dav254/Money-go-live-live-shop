'use client';

import * as React from 'react';
import Link from 'next/link';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useUser } from '@/firebase';
import { fetchMyRequests } from '@/lib/requests/client';
import type { MarketplaceRequest } from '@/lib/requests/types';
import { budgetLabel } from '@/lib/requests/labels';
import { StatusBadge } from './status-badge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, MapPin, CalendarDays, Eye, MessageSquareText, Loader2 } from 'lucide-react';

export default function MyRequestsPage() {
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
    <BuyerLayout>
      <div className="mx-auto max-w-4xl space-y-6 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
              Request Marketplace
            </p>
            <h1 className="font-grotesk text-3xl font-black uppercase tracking-tight">My Requests</h1>
            <p className="text-sm font-medium text-muted-foreground">
              Track responses from businesses and accept the best offer.
            </p>
          </div>
          <Button asChild className="rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] font-black uppercase tracking-wide shadow-lg shadow-primary/25">
            <Link href="/buyer/requests/new">
              <Plus className="mr-2 h-4 w-4" /> New Request
            </Link>
          </Button>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your requests…
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>
        )}

        {!loading && requests?.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <p className="font-grotesk text-lg font-black uppercase">No requests yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Post what you need — with photos or a short video — and let matched businesses
                come to you with offers.
              </p>
              <Button asChild className="mt-2 rounded-xl">
                <Link href="/buyer/requests/new">Post your first request</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {(requests ?? []).map((r) => (
            <Link key={r.id} href={`/requests/${r.id}`} className="block">
              <Card className="transition hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-grotesk text-lg font-bold">{r.title}</h2>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="line-clamp-1 text-sm text-muted-foreground">{r.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      <span>{r.category}</span>
                      {r.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {r.location}
                        </span>
                      )}
                      {r.deadline && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {r.deadline}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant="secondary" className="rounded-full font-bold">
                      <MessageSquareText className="mr-1 h-3 w-3" /> {r.offersCount ?? 0} offers
                    </Badge>
                    <span className="text-xs font-black">{budgetLabel(r)}</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                      <Eye className="h-3 w-3" /> {r.views ?? 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </BuyerLayout>
  );
}


