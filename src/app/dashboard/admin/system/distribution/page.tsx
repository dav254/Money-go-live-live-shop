'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Database,
  History,
  ListChecks,
  Network,
  RefreshCw,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * DISTRIBUTION CONTROL CENTER — the admin home of the Core Engine.
 *
 * Eight sections, one admin-only API surface:
 *   1 Overview & engine health   5 Errors, retries & dead letter
 *   2 API connections            6 Traffic & conversion analytics
 *   3 Product & job queues       7 Configuration, limits & global pause
 *   4 Publication per destination 8 Audit history
 *
 * Honesty rules mirrored from the server: unknown counters render as “—”
 * (never a fabricated 0), “accepted” and “verified” are shown as different
 * things everywhere, and no token/env VALUE ever reaches this page — the
 * connections section only ever sees variable NAMES.
 */

type Count = number | null;

interface EngineInfo {
  paused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  maxPerRun: number;
  maxPerDay: number;
  lastRunAt: string | null;
  sitemapSubmittedAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface Connection {
  id: string;
  label: string;
  kind: string;
  jobEligible: boolean;
  status: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  capabilities: { submit: boolean; verify: boolean; confirmable: string[] };
}

interface FailedJob {
  jobId: string;
  productId: string | null;
  channel: string | null;
  attempts: number;
  error: { class: string; message: string; at: string } | null;
  retryable: boolean;
}

interface DestinationTraffic {
  destination: string;
  label: string;
  qualifiedViews: Count;
  shareClicks: Count;
  attributedOrders: Count;
}

interface AuditEntry {
  id: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId?: string;
  destination?: string;
  at: string | null;
  detail: string | null;
}

interface Overview {
  generatedAt: string;
  engine: EngineInfo;
  connections: Connection[];
  queues: {
    byStatus: Record<string, Count>;
    byDestination: Record<string, Count>;
    deadLetterCount: Count;
    needsAttention: Count;
    failedTotal: Count;
    recentFailed: FailedJob[];
  };
  publication: {
    byConfirmation: Record<string, Count>;
    byDestination: Record<
      string,
      { total: Count; byConfirmation: Record<string, Count> }
    >;
    note: string;
  };
  analytics: {
    perDestination: DestinationTraffic[];
    notes: string[];
  };
  ga: {
    configured: boolean;
    totalSessions: Count;
    byDate: Array<{ date: string; sessions: number }>;
    error?: string;
  };
  audit: AuditEntry[];
}

interface AdminJob {
  jobId: string;
  productId: string | null;
  channel: string | null;
  status: string;
  attempts: number;
  verifyAttempts: number;
  adminRequeues: number;
  integrationStatus: string;
  confirmation: {
    state: string;
    remoteId: string | null;
    at: string | null;
    verifiedAt: string | null;
    message: string | null;
  } | null;
  submissions: Array<{
    at: string;
    attempt: number;
    outcome: string;
    responseStatus?: number;
    remoteId?: string;
    errorClass?: string;
    message?: string;
  }>;
  deadLetter: boolean;
  lastError: { class: string; message: string; at: string | null } | null;
  updatedAt: string | null;
}

const STATUS_LABELS: Array<[string, string]> = [
  ['not_configured', 'Not configured'],
  ['ready', 'Prepared'],
  ['queued', 'Queued'],
  ['processing', 'Processing'],
  ['submitted', 'Submitted'],
  ['live', 'Confirmed'],
  ['failed', 'Failed'],
  ['needs_attention', 'Needs attention'],
  ['stopped', 'Stopped'],
];

const CONFIRMATION_LABELS: Array<[string, string]> = [
  ['none', 'None'],
  ['accepted', 'Accepted'],
  ['published', 'Published (verified)'],
  ['indexed', 'Indexed (verified)'],
  ['unknown', 'Unknown'],
  ['failed', 'Failed'],
];

/** `null` means the count could not be read — unknown, not zero. */
function count(value: Count): string {
  return value === null || value === undefined ? '—' : String(value);
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleString();
}

function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 14 ? `${id.slice(0, 14)}…` : id;
}

export default function DistributionControlCenterPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [limits, setLimits] = useState<{ maxPerRun: number; maxPerDay: number }>({
    maxPerRun: 10,
    maxPerDay: 100,
  });

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) throw new Error('Not signed in.');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const toastError = useCallback(
    (title: string, e: unknown) => {
      toast({
        variant: 'destructive',
        title,
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    },
    [toast],
  );

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/distribution/overview', { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to load overview');
      setOverview(body as Overview);
      setLimits({
        maxPerRun: body.engine?.maxPerRun ?? 10,
        maxPerDay: body.engine?.maxPerDay ?? 100,
      });
    } catch (e) {
      setFailed(true);
      toastError('Distribution overview unavailable', e);
    } finally {
      setLoading(false);
    }
  }, [user, authHeaders, toastError]);

  const loadJobs = useCallback(
    async (status?: string) => {
      if (!user) return;
      try {
        const headers = await authHeaders();
        const qs = status ? `?status=${encodeURIComponent(status)}&limit=50` : '?limit=50';
        const res = await fetch(`/api/admin/distribution/jobs${qs}`, { headers });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Failed to load jobs');
        setJobs((body.items ?? []) as AdminJob[]);
      } catch (e) {
        toastError('Job queues unavailable', e);
      }
    },
    [user, authHeaders, toastError],
  );

  useEffect(() => {
    void loadOverview();
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const action = useCallback(
    async (
      key: string,
      path: string,
      method: 'POST' | 'PUT',
      body: unknown,
      success: string,
      after?: () => void,
    ) => {
      if (busy) return;
      setBusy(key);
      try {
        const headers = await authHeaders();
        const res = await fetch(path, {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        toast({ title: success });
        after?.();
      } catch (e) {
        toastError('Action failed', e);
      } finally {
        setBusy(null);
      }
    },
    [busy, authHeaders, toast, toastError],
  );

  const engine = overview?.engine;
  const connections = overview?.connections ?? [];
  const analytics = overview?.analytics;
  const deadLetterJobs = useMemo(() => jobs.filter((j) => j.deadLetter), [jobs]);

  const refreshAll = useCallback(() => {
    void loadOverview();
    void loadJobs(statusFilter || undefined);
  }, [loadOverview, loadJobs, statusFilter]);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Send className="h-6 w-6 text-primary" /> Distribution Control Center
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Free-first discovery · queues · confirmation · limits
            </p>
          </div>
          <div className="flex items-center gap-2">
            {engine && (
              <Badge variant={engine.paused ? 'destructive' : 'default'} className="uppercase">
                {engine.paused ? 'Engine paused' : 'Engine active'}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading || busy !== null}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {failed && !loading && (
          <Card className="border-destructive/40">
            <CardContent className="py-6 text-sm text-muted-foreground">
              The overview endpoint did not respond. Nothing on this page is inferred — retry when
              the server is reachable.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 h-auto py-1">
            <TabsTrigger value="overview">1 · Overview</TabsTrigger>
            <TabsTrigger value="connections">2 · Connections</TabsTrigger>
            <TabsTrigger value="queues">3 · Queues</TabsTrigger>
            <TabsTrigger value="publication">4 · Publication</TabsTrigger>
            <TabsTrigger value="errors">5 · Errors</TabsTrigger>
            <TabsTrigger value="analytics">6 · Analytics</TabsTrigger>
            <TabsTrigger value="settings">7 · Settings</TabsTrigger>
            <TabsTrigger value="audit">8 · Audit</TabsTrigger>
          </TabsList>

          {/* ── 1. Overview & engine health ─────────────────────────────── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5" /> Jobs by state
                  </CardDescription>
                  <CardTitle className="text-3xl font-black">
                    {count(overview?.queues.byStatus.queued ?? null)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground">
                  Currently queued across all destinations
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                  </CardDescription>
                  <CardTitle className="text-3xl font-black">
                    {count(overview?.queues.byStatus.live ?? null)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground">
                  Verified published/indexed — never self-declared
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" /> Dead letter
                  </CardDescription>
                  <CardTitle className="text-3xl font-black">
                    {count(overview?.queues.deadLetterCount ?? null)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground">
                  Failures no automatic retry will touch
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Wrench className="h-3.5 w-3.5" /> Needs attention
                  </CardDescription>
                  <CardTitle className="text-3xl font-black">
                    {count(overview?.queues.needsAttention ?? null)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] text-muted-foreground">
                  Parked for a human decision
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" /> Engine health
                </CardTitle>
                <CardDescription>
                  Real state read from the engine config — a run only ever happens when an admin
                  triggers it here or a scheduler calls the same admin endpoint.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Global pause
                  </p>
                  <p className="font-semibold">{engine?.paused ? 'PAUSED — no submissions' : 'Active'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {engine?.paused ? `since ${formatWhen(engine.pausedAt)}` : 'submissions allowed within limits'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Last engine run
                  </p>
                  <p className="font-semibold">{formatWhen(engine?.lastRunAt)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    budget {engine?.maxPerRun ?? '—'} / run · {engine?.maxPerDay ?? '—'} / destination / day
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Search Console sitemap
                  </p>
                  <p className="font-semibold">{formatWhen(engine?.sitemapSubmittedAt)}</p>
                  <p className="text-[11px] text-muted-foreground">daily submission, shown only when authorized</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Jobs by state
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {STATUS_LABELS.map(([key, label]) => (
                      <Badge key={key} variant="outline" className="text-[10px]">
                        {label}: {count(overview?.queues.byStatus[key] ?? null)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Destination totals
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(Object.entries(overview?.queues.byDestination ?? {}) as Array<[string, Count]>).map(
                      ([id, value]) => (
                        <Badge key={id} variant="secondary" className="text-[10px]">
                          {id}: {count(value)}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy !== null || !user}
                onClick={() =>
                  action('reconcile', '/api/admin/distribution/reconcile', 'POST', {}, 'Reconciliation sweep complete', refreshAll)
                }
              >
                <Database className={`mr-2 h-4 w-4 ${busy === 'reconcile' ? 'animate-pulse' : ''}`} />
                Run reconciliation
              </Button>
              <Button
                size="sm"
                disabled={busy !== null || !user || engine?.paused}
                onClick={() =>
                  action('run', '/api/admin/distribution/run', 'POST', undefined, 'Engine pass complete', refreshAll)
                }
                title={engine?.paused ? 'Resume the engine first' : 'One bounded pass: submit + verify'}
              >
                <CirclePlay className={`mr-2 h-4 w-4 ${busy === 'run' ? 'animate-pulse' : ''}`} />
                Run engine pass
              </Button>
            </div>
          </TabsContent>

          {/* ── 2. API connections ──────────────────────────────────────── */}
          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Network className="h-4 w-4" /> Destination connections
                </CardTitle>
                <CardDescription>
                  Environment presence only — variable names, never values. “Configured” means the
                  credentials exist on the server; it is never a claim that the platform approved
                  anything.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {connections.length === 0 && (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
                {connections.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {c.label}{' '}
                        <Badge variant="outline" className="ml-1 text-[10px] uppercase">
                          {c.kind}
                        </Badge>
                        {!c.jobEligible && (
                          <Badge variant="secondary" className="ml-1 text-[10px]">
                            connection only
                          </Badge>
                        )}
                      </p>
                      <p className="flex flex-wrap gap-1">
                        {c.requiredEnvVars.length === 0 && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            no credentials required
                          </Badge>
                        )}
                        {c.requiredEnvVars.map((name) => (
                          <Badge key={name} variant="outline" className="font-mono text-[10px]">
                            {name}
                          </Badge>
                        ))}
                        {c.optionalEnvVars.map((name) => (
                          <Badge key={name} variant="secondary" className="font-mono text-[10px]">
                            {name} (optional)
                          </Badge>
                        ))}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.capabilities.submit && 'submits · '}
                        {c.capabilities.verify && 'verifies status · '}
                        {c.capabilities.confirmable.length > 0
                          ? `can claim: ${c.capabilities.confirmable.join(', ')}`
                          : 'makes no confirmation claims'}
                      </p>
                    </div>
                    <Badge variant={c.status === 'configured' ? 'default' : 'secondary'}>
                      {c.status === 'configured' ? 'Configured' : 'Not configured'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 3. Product & job queues ─────────────────────────────────── */}
          <TabsContent value="queues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4" /> Job queues
                </CardTitle>
                <CardDescription>
                  Per-listing distribution jobs. Filters are server-validated; results are capped at
                  50 rows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={statusFilter === '' ? 'default' : 'outline'}
                    onClick={() => {
                      setStatusFilter('');
                      void loadJobs();
                    }}
                  >
                    All
                  </Button>
                  {STATUS_LABELS.map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={statusFilter === key ? 'default' : 'outline'}
                      className="text-xs"
                      onClick={() => {
                        setStatusFilter(key);
                        void loadJobs(key);
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {jobs.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground">
                    No jobs match this filter. Run a reconciliation sweep to populate queues from
                    the catalog.
                  </p>
                )}

                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold">
                          {job.channel ?? '—'}{' '}
                          <span className="font-mono text-xs text-muted-foreground">
                            {shortId(job.productId)}
                          </span>
                        </p>
                        <p className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {job.status}
                          </Badge>
                          {job.confirmation && (
                            <Badge
                              variant={
                                job.confirmation.state === 'published' ||
                                job.confirmation.state === 'indexed'
                                  ? 'default'
                                  : job.confirmation.state === 'unknown' ||
                                      job.confirmation.state === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {job.confirmation.state}
                            </Badge>
                          )}
                          {job.deadLetter && (
                            <Badge variant="destructive" className="text-[10px]">
                              dead letter
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            attempts {job.attempts}
                            {job.verifyAttempts > 0 ? ` · verifies ${job.verifyAttempts}` : ''}
                          </Badge>
                        </p>
                        {job.lastError && (
                          <p className="text-xs text-muted-foreground">
                            <Badge variant="outline" className="mr-2 uppercase text-[10px]">
                              {job.lastError.class}
                            </Badge>
                            {job.lastError.message}
                          </p>
                        )}
                        {job.submissions[0] && (
                          <p className="text-[11px] text-muted-foreground">
                            last attempt: {job.submissions[0].outcome}
                            {job.submissions[0].responseStatus
                              ? ` · HTTP ${job.submissions[0].responseStatus}`
                              : ''}{' '}
                            · {formatWhen(job.submissions[0].at)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          updated {formatWhen(job.updatedAt)}
                        </span>
                        {job.deadLetter && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() =>
                              action(
                                `requeue:${job.jobId}`,
                                `/api/admin/distribution/jobs/${job.jobId}/requeue`,
                                'POST',
                                {},
                                'Job re-queued (admin reset)',
                                refreshAll,
                              )
                            }
                            title="Bounded admin re-queue (max 2 per job)"
                          >
                            Re-queue
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 4. Per-destination publication ──────────────────────────── */}
          <TabsContent value="publication" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" /> Publication by destination
                </CardTitle>
                <CardDescription>{overview?.publication.note}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="py-2 pr-3">Destination</th>
                      <th className="py-2 pr-3">Total</th>
                      {CONFIRMATION_LABELS.map(([key, label]) => (
                        <th key={key} className="py-2 pr-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(overview?.publication.byDestination ?? {}) as Array<
                      [string, { total: Count; byConfirmation: Record<string, Count> }]
                    >).map(([dest, row]) => (
                      <tr key={dest} className="border-b border-border/40">
                        <td className="py-2 pr-3 font-semibold">{dest}</td>
                        <td className="py-2 pr-3">{count(row.total)}</td>
                        {CONFIRMATION_LABELS.map(([key]) => (
                          <td key={key} className="py-2 pr-3">
                            {count(row.byConfirmation[key] ?? null)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {(Object.keys(overview?.publication.byDestination ?? {}).length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={8} className="py-4 text-muted-foreground">
                          Loading…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 5. Errors, retries, dead letter ─────────────────────────── */}
          <TabsContent value="errors" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Failed (total)</CardDescription>
                  <CardTitle className="text-2xl font-black">
                    {count(overview?.queues.failedTotal ?? null)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Dead letter (exact)</CardDescription>
                  <CardTitle className="text-2xl font-black">
                    {count(overview?.queues.deadLetterCount ?? null)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Needs attention</CardDescription>
                  <CardTitle className="text-2xl font-black">
                    {count(overview?.queues.needsAttention ?? null)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" /> Recent failures
                </CardTitle>
                <CardDescription>
                  Sanitized error classes only. Retries are bounded (max 3 attempts), and only
                  rate-limited/transient failures retry automatically — auth and validation failures
                  need a config change first. Dead-letter jobs can be re-queued here (max 2 admin
                  resets per job).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(overview?.queues.recentFailed ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No failed jobs in the current window.</p>
                )}
                {(overview?.queues.recentFailed ?? []).map((job) => (
                  <div
                    key={job.jobId}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {job.channel ?? 'unknown destination'}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          {shortId(job.productId)}
                        </span>
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
                        attempt {job.attempts} · {formatWhen(job.error?.at ?? null)}
                      </p>
                    </div>
                    <Badge variant={job.retryable ? 'outline' : 'destructive'}>
                      {job.retryable ? 'auto-retryable' : 'needs a human'}
                    </Badge>
                  </div>
                ))}
                {deadLetterJobs.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {deadLetterJobs.length} dead-letter job{deadLetterJobs.length === 1 ? '' : 's'}{' '}
                    visible in the Queues tab (re-queue from there).
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 6. Traffic & conversion analytics ───────────────────────── */}
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" /> Destination traffic & conversions
                </CardTitle>
                <CardDescription>
                  Real recorded events only — deduplicated, qualified views from tracked links and
                  server-verified orders. Nothing here is estimated, backfilled or modelled.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th className="py-2 pr-3">Destination</th>
                        <th className="py-2 pr-3">Qualified views</th>
                        <th className="py-2 pr-3">Share clicks</th>
                        <th className="py-2 pr-3">Attributed orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analytics?.perDestination ?? []).map((row) => (
                        <tr key={row.destination} className="border-b border-border/40">
                          <td className="py-2 pr-3 font-semibold">{row.label}</td>
                          <td className="py-2 pr-3">{count(row.qualifiedViews)}</td>
                          <td className="py-2 pr-3">{count(row.shareClicks)}</td>
                          <td className="py-2 pr-3">{count(row.attributedOrders)}</td>
                        </tr>
                      ))}
                      {(analytics?.perDestination ?? []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-muted-foreground">
                            Loading…
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-semibold">
                    Google Analytics (last 7 days){' '}
                    <Badge variant={overview?.ga.configured ? 'default' : 'secondary'} className="ml-1">
                      {overview?.ga.configured ? 'Connected' : 'Not configured'}
                    </Badge>
                  </p>
                  {overview?.ga.configured ? (
                    overview.ga.error ? (
                      <p className="text-xs text-muted-foreground">{overview.ga.error}</p>
                    ) : (
                      <p className="text-xl font-black">
                        {count(overview.ga.totalSessions)}{' '}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          sessions
                        </span>
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON on the server to read real
                      session data here.
                    </p>
                  )}
                </div>

                {(analytics?.notes ?? []).map((note) => (
                  <p key={note} className="text-[11px] text-muted-foreground">
                    {note}
                  </p>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 7. Configuration, limits, global pause ───────────────────── */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" /> Engine configuration
                </CardTitle>
                <CardDescription>
                  The pause switch stops ALL submissions immediately — queued jobs stay queued and
                  no attempt is burned. Limits are hard-clamped server-side (1–50 per run,
                  1–1000 per destination per day).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                  <div className="space-y-1">
                    <Label htmlFor="pause-switch" className="font-semibold">
                      Global pause
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {engine?.paused
                        ? `Paused since ${formatWhen(engine.pausedAt)} by ${engine.pausedBy ?? 'admin'}`
                        : 'Engine may run within the configured limits.'}
                    </p>
                  </div>
                  <Switch
                    id="pause-switch"
                    checked={engine?.paused ?? false}
                    disabled={busy !== null || !user}
                    onCheckedChange={(checked) =>
                      action(
                        'pause',
                        '/api/admin/distribution/config',
                        'PUT',
                        { paused: checked },
                        checked ? 'Distribution paused' : 'Distribution resumed',
                        refreshAll,
                      )
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max-per-run">Max jobs per engine run (1–50)</Label>
                    <Input
                      id="max-per-run"
                      type="number"
                      min={1}
                      max={50}
                      value={limits.maxPerRun}
                      onChange={(e) =>
                        setLimits((l) => ({ ...l, maxPerRun: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-per-day">Max jobs per destination per day (1–1000)</Label>
                    <Input
                      id="max-per-day"
                      type="number"
                      min={1}
                      max={1000}
                      value={limits.maxPerDay}
                      onChange={(e) =>
                        setLimits((l) => ({ ...l, maxPerDay: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    disabled={busy !== null || !user}
                    onClick={() =>
                      action(
                        'saveConfig',
                        '/api/admin/distribution/config',
                        'PUT',
                        {
                          maxPerRun: Math.max(1, Math.min(50, Math.floor(limits.maxPerRun))),
                          maxPerDay: Math.max(1, Math.min(1000, Math.floor(limits.maxPerDay))),
                        },
                        'Limits saved',
                        refreshAll,
                      )
                    }
                  >
                    Save limits
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy !== null || !user}
                    onClick={() =>
                      action('reconcile2', '/api/admin/distribution/reconcile', 'POST', {}, 'Reconciliation sweep complete', refreshAll)
                    }
                  >
                    <Database className="mr-2 h-4 w-4" /> Run reconciliation
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy !== null || !user || engine?.paused}
                    onClick={() =>
                      action('run2', '/api/admin/distribution/run', 'POST', undefined, 'Engine pass complete', refreshAll)
                    }
                  >
                    <CirclePlay className="mr-2 h-4 w-4" /> Run engine pass
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Connection credentials are environment variables on the server — they can never be
                  entered (or read back) through this page. Last config change:{' '}
                  {formatWhen(engine?.updatedAt)} by {engine?.updatedBy ?? '—'}.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 8. Audit history ────────────────────────────────────────── */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" /> Audit history
                </CardTitle>
                <CardDescription>
                  Append-only record of every management action: who, what, when. Entries are
                  sanitized at write time and there is no edit or delete path.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(overview?.audit ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No management actions recorded yet.
                  </p>
                )}
                {(overview?.audit ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 p-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold">
                        <Badge variant="outline" className="mr-2 uppercase">
                          {entry.action}
                        </Badge>
                        {entry.detail ?? entry.targetType}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {entry.actorUid} · {entry.targetType}
                        {entry.targetId ? `:${shortId(entry.targetId)}` : ''}
                        {entry.destination ? ` · ${entry.destination}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {formatWhen(entry.at)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5" />
          Overview generated {formatWhen(overview?.generatedAt)} ·{' '}
          <CirclePause className="h-3.5 w-3.5" /> pause and limits are enforced server-side on every
          engine pass.
        </div>
      </div>
    </AdminLayout>
  );
}
