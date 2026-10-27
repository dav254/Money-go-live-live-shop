'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  PackageSearch,
  Radio,
  RefreshCw,
  Settings,
  Users,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * Admin Core Engine status — a thin consumer of GET /api/admin/core-engine/status.
 *
 * The API already limits itself to counts, boolean integration flags and
 * sanitized job errors; this page renders exactly that. Unknown counters come
 * back as `null` and are shown as "—" — never as a fabricated 0. No
 * credentials, no environment values, no user identifiers.
 */

type Count = number | null;

interface FailedJob {
  jobId: string;
  productId: string | null;
  channel: string | null;
  attempts: number;
  error: { class: string; message: string; at: string } | null;
  retryable: boolean;
}

interface StatusPayload {
  distribution: { byStatus: Record<string, Count>; recentFailed: FailedJob[] };
  events: { verifiedOutcomes: Count; observedViews: Count; shareClicks: Count; note: string };
  opportunities: Record<string, Count>;
  applications: Record<string, Count>;
  integrations: Record<string, { label: string; status: string; requiredEnvVars: string[] }>;
}

const JOB_STATUS_LABELS: Array<[string, string]> = [
  ['not_configured', 'Not configured'],
  ['ready', 'Ready'],
  ['queued', 'Queued'],
  ['processing', 'Processing'],
  ['submitted', 'Submitted'],
  ['live', 'Live'],
  ['failed', 'Failed'],
  ['needs_attention', 'Needs attention'],
];

const APPLICATION_LABELS: Array<[string, string]> = [
  ['submitted', 'Awaiting review'],
  ['under_review', 'Under review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['withdrawn', 'Withdrawn'],
];

/** `null` means the count could not be read — unknown, not zero. */
function count(value: Count): string {
  return value === null || value === undefined ? '—' : String(value);
}

function unknownNote(value: Count): string {
  return value === null || value === undefined ? 'unknown' : '';
}

function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleString();
}

export default function AdminCoreEnginePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/core-engine/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load status');
      setData(body as StatusPayload);
    } catch (e) {
      setFailed(true);
      toast({
        variant: 'destructive',
        title: 'Core Engine status unavailable',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingReviews = data?.applications?.submitted ?? null;
  const integrations = data ? Object.entries(data.integrations) : [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Activity className="h-6 w-6 text-primary" /> Core Engine
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Distribution · verified events · opportunity review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/admin/system/opportunities">
                <Users className="mr-2 h-4 w-4" /> Review applications
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading || !user}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {failed && !loading && (
          <Card className="border-destructive/40">
            <CardContent className="py-6 text-sm text-muted-foreground">
              The status endpoint did not respond. Nothing on this page is inferred — retry when the
              server is reachable.
            </CardContent>
          </Card>
        )}

        {/* Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5" /> Verified outcomes
              </CardDescription>
              <CardTitle className="text-3xl font-black">{count(data?.events?.verifiedOutcomes ?? null)}</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground">
              Server-confirmed events (retained window)
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" /> Observed views
              </CardDescription>
              <CardTitle className="text-3xl font-black">{count(data?.events?.observedViews ?? null)}</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground">
              Deduplicated listing views — not sales
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5" /> Share clicks
              </CardDescription>
              <CardTitle className="text-3xl font-black">{count(data?.events?.shareClicks ?? null)}</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground">Tracked share-link taps</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Applications awaiting review
              </CardDescription>
              <CardTitle className="text-3xl font-black">{count(pendingReviews)}</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground">
              {unknownNote(pendingReviews) || 'Queue for admin decisions'}
            </CardContent>
          </Card>
        </div>

        {/* Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="h-4 w-4" /> Distribution jobs
            </CardTitle>
            <CardDescription>
              Prepare-only channel jobs. A channel without credentials can never leave “ready”, and
              nothing here reports a listing as live on its own.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {JOB_STATUS_LABELS.map(([key, label]) => {
                const value = data?.distribution?.byStatus?.[key] ?? null;
                return (
                  <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-xl font-black" title={unknownNote(value)}>
                      {count(value)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Recent failures
              </p>
              {(data?.distribution?.recentFailed ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No failed jobs in the current window.</p>
              )}
              {(data?.distribution?.recentFailed ?? []).map((job) => (
                <div
                  key={job.jobId}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      {job.channel ?? 'unknown channel'}{' '}
                      <span className="font-mono text-xs text-muted-foreground">{job.productId ?? '—'}</span>
                    </p>
                    {job.error && (
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-2 uppercase">
                          {job.error.class}
                        </Badge>
                        {job.error.message}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      attempt {job.attempts} · {formatWhen(job.error?.at ?? '')}
                    </p>
                  </div>
                  {job.retryable ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-label="Retryable" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Needs a human" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Opportunities & applications */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> Opportunities
              </CardTitle>
              <CardDescription>Funded task listings. Budgets are declarations, never balances.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                Object.entries(data?.opportunities ?? {}) as Array<[string, Count]>
              ).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{key}</p>
                  <p className="text-xl font-black" title={unknownNote(value)}>
                    {count(value)}
                  </p>
                </div>
              ))}
              {!data && <p className="text-sm text-muted-foreground">Loading…</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" /> Applications
              </CardTitle>
              <CardDescription>Review states. Approvals record an event only — no money moves.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {APPLICATION_LABELS.map(([key, label]) => {
                const value = data?.applications?.[key] ?? null;
                return (
                  <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-xl font-black" title={unknownNote(value)}>
                      {count(value)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" /> Channel integrations
            </CardTitle>
            <CardDescription>
              Presence of configuration only — environment values are never read into or returned by
              this view.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {integrations.length === 0 && <p className="text-sm text-muted-foreground">Loading…</p>}
            {integrations.map(([id, channel]) => (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{channel.label}</p>
                  <p className="flex flex-wrap gap-1">
                    {channel.requiredEnvVars.map((name) => (
                      <Badge key={name} variant="outline" className="font-mono text-[10px]">
                        {name}
                      </Badge>
                    ))}
                  </p>
                </div>
                <Badge variant={channel.status === 'configured' ? 'default' : 'secondary'}>
                  {channel.status === 'configured' ? 'Configured' : 'Not configured'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {data?.events?.note && (
          <p className="text-[11px] text-muted-foreground">{data.events.note}</p>
        )}
      </div>
    </AdminLayout>
  );
}
