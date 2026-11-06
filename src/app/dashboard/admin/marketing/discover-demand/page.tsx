'use client';

/**
 * ADMIN · DISCOVERY DEMAND.
 *
 * What customers search for, where they search, and what they fail to find —
 * beside the supply side (registered sellers, completed shops, published
 * listings). The gap between the two is the work.
 *
 * The report is aggregate only. No query text, no customer identity and no
 * session data is collected, so there is nothing here to leak.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, SearchX, TrendingDown, Users } from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';

interface Bucket {
  key: string;
  count: number;
}

interface Report {
  generatedAt: string;
  demand: {
    totalSearches: number;
    zeroResultSearches: number;
    zeroResultRate: number;
    byCategory: Bucket[];
    byLocation: Bucket[];
    windowCapped: boolean;
  };
  sellers: {
    registeredSellers: number;
    suspended: number;
    completedShops: number;
    incompleteShops: number;
    windowCapped: boolean;
  };
  catalogue: {
    publishedListings: number;
    publishedServices: number;
    unpublished: number;
    windowCapped: boolean;
  };
}

function BucketTable({
  title,
  description,
  buckets,
  emptyLabel,
}: {
  title: string;
  description: string;
  buckets: Bucket[];
  emptyLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {buckets.map((bucket) => (
              <li key={bucket.key} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize">{bucket.key.replace(/-/g, ' ')}</span>
                <span className="font-mono text-muted-foreground">{bucket.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export default function DiscoverDemandPage() {
  const { user } = useUser();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/discover-demand', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as Report & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Request failed (HTTP ${response.status}).`);
      setReport(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the report.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Discovery demand</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              What customers search for on <span className="font-mono">/discover</span>, where they
              search, and what they cannot find. Counts are anonymous aggregates — no query text or
              customer identity is stored.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Report unavailable</p>
              <p className="text-red-700/80">{error}</p>
            </div>
          </div>
        ) : null}

        {loading && !report ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building the report…
          </div>
        ) : null}

        {report ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Searches" value={report.demand.totalSearches} />
              <Stat
                label="No results"
                value={report.demand.zeroResultSearches}
                hint={`${report.demand.zeroResultRate}% of searches`}
              />
              <Stat
                label="Registered sellers"
                value={report.sellers.registeredSellers}
                hint={report.sellers.suspended ? `${report.sellers.suspended} suspended` : undefined}
              />
              <Stat
                label="Complete shops"
                value={report.sellers.completedShops}
                hint={`${report.sellers.incompleteShops} still incomplete`}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <BucketTable
                title="Searches by category"
                description="The trade customers were looking for."
                buckets={report.demand.byCategory}
                emptyLabel="No categorised searches recorded yet."
              />
              <BucketTable
                title="Searches by location"
                description="The county customers filtered to."
                buckets={report.demand.byLocation}
                emptyLabel="No located searches recorded yet."
              />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Supply</CardTitle>
                <CardDescription>
                  What exists to satisfy that demand right now.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{report.sellers.completedShops} completed public shops</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span>{report.sellers.incompleteShops} registered but incomplete</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <SearchX className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {report.catalogue.publishedListings} published listings
                    {report.catalogue.publishedServices
                      ? ` (${report.catalogue.publishedServices} services)`
                      : ''}
                  </span>
                </div>
              </CardContent>
            </Card>

            {report.demand.windowCapped ||
            report.sellers.windowCapped ||
            report.catalogue.windowCapped ? (
              <p className="text-xs text-muted-foreground">
                Some figures are bounded scans over recent records — treat them as a floor rather
                than an exact marketplace total.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
