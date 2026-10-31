'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  FileSearch,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * SEARCH ENGINE CENTER — the admin home for Google, Bing, Yandex and
 * IndexNow.
 *
 * Every status on this page comes from a check the server performed on this
 * request (see src/lib/seo/search-engine-center.ts): a probe of our own
 * public origin, environment-variable PRESENCE, or a live official API call
 * the admin explicitly triggers. Nothing here is decorated to look working:
 * an action whose backend dependency is absent is disabled with the exact
 * reason, and no status claims engine acceptance we could not read.
 */

type EngineStatus = 'verified' | 'connected' | 'pending' | 'not_configured' | 'error';

interface EngineCheck {
  label: string;
  state: 'pass' | 'fail' | 'skip';
  detail: string;
}

interface EngineRow {
  id: string;
  label: string;
  status: EngineStatus;
  detail: string;
  requiredEnvVars: string[];
  configured: boolean;
  checks: EngineCheck[];
  artifactUrl: string | null;
}

interface SeoPayload {
  robots: { ok: boolean; detail: string; sitemapLine: string | null };
  sitemap: { ok: boolean; urlCount: number; productUrls: number; shopUrls: number; detail: string };
  canonical: { present: boolean; url: string | null; matchesOrigin: boolean; detail: string };
}

interface StatusPayload {
  origin: string;
  configuredOrigin: string;
  checkedAt: string;
  liveCheckRan: boolean;
  engines: EngineRow[];
  seo: SeoPayload;
}

interface SubmissionRow {
  at: string | null;
  outcome: string;
  responseStatus?: number;
  message?: string;
}

interface HistoryPayload {
  store: 'ok' | 'unavailable';
  storeNote: string | null;
  checkedAt: string;
  engine: {
    paused: boolean;
    lastRunAt: string | null;
    sitemapSubmittedAt: string | null;
    maxPerRun: number;
    maxPerDay: number;
  } | null;
  statusCounts: Record<string, number | null> | null;
  audit: {
    id: string;
    action: string;
    destination?: string;
    at: string | null;
    detail: string | null;
    actorUid: string;
  }[];
  jobs: {
    id: string;
    channel: string;
    url: string | null;
    status: string;
    updatedAt: string | null;
    submissions: SubmissionRow[];
  }[];
  summary: {
    urlsTracked: number;
    attempts: number;
    lastSuccess: (SubmissionRow & { channel: string; url: string | null }) | null;
    lastError: (SubmissionRow & { channel: string; url: string | null }) | null;
  };
}

interface SpotPage {
  path: string;
  ok: boolean;
  status: number | null;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  canonical: string | null;
  robots: string | null;
  issues: string[];
}

const STATUS_META: Record<EngineStatus, { label: string; className: string }> = {
  verified: { label: 'Verified', className: 'border-green-500/50 bg-green-500/15 text-green-400' },
  connected: { label: 'Connected', className: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' },
  pending: { label: 'Pending', className: 'border-amber-500/50 bg-amber-500/15 text-amber-300' },
  not_configured: { label: 'Not configured', className: 'border-border bg-muted text-muted-foreground' },
  error: { label: 'Error', className: 'border-red-500/60 bg-red-500/15 text-red-400' },
};

function StatusBadge({ status }: { status: EngineStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_configured;
  return (
    <Badge variant="outline" className={`font-bold uppercase tracking-wider ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function CheckIcon({ state }: { state: EngineCheck['state'] }) {
  if (state === 'pass') return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />;
  if (state === 'fail') return <XCircle className="h-4 w-4 shrink-0 text-red-400" />;
  return <CircleSlash className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

function isoShort(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export default function SearchEngineCenterPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [singleUrl, setSingleUrl] = useState('/');
  const [batchUrls, setBatchUrls] = useState('/');
  const [lastAction, setLastAction] = useState<{ label: string; ok: boolean; message: string } | null>(null);
  const [spotPages, setSpotPages] = useState<SpotPage[] | null>(null);

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

  const loadStatus = useCallback(
    async (live = false) => {
      if (!user) return;
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/admin/search-engines/status${live ? '?live=1' : ''}`, { headers });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Status unavailable');
        setStatus(body as StatusPayload);
        setFailed(false);
      } catch (e) {
        setFailed(true);
        toastError('Search engine status unavailable', e);
      }
    },
    [user, authHeaders, toastError],
  );

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/search-engines/history', { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'History unavailable');
      setHistory(body as HistoryPayload);
    } catch (e) {
      toastError('Submission history unavailable', e);
    }
  }, [user, authHeaders, toastError]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    void (async () => {
      setLoading(true);
      await Promise.all([loadStatus(), loadHistory()]);
      if (live) setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [user, loadStatus, loadHistory]);

  const parsePaths = useCallback((text: string): string[] => {
    const list = text
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      // Site-relative only — the server re-validates every path anyway.
      .map((s) => (s.startsWith('/') ? s : `/${s}`));
    return [...new Set(list)].slice(0, 10);
  }, []);

  const runAction = useCallback(
    async (key: string, label: string, payload: Record<string, unknown>, after?: () => void) => {
      if (busy) return;
      setBusy(key);
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/admin/search-engines/submit', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Request failed');
        const message =
          typeof body.result?.message === 'string' && body.result.message
            ? body.result.message
            : body.ok
              ? 'Submitted — the engine response is recorded in Activity.'
              : `Not submitted (${body.result?.outcome ?? body.result?.reason ?? 'unknown reason'}).`;
        setLastAction({ label, ok: Boolean(body.ok), message });
        if (body.ok) toast({ title: label, description: message });
        else toast({ variant: 'destructive', title: label, description: message });
        after?.();
        void loadHistory();
      } catch (e) {
        toastError(label, e);
      } finally {
        setBusy(null);
      }
    },
    [busy, authHeaders, toast, toastError, loadHistory],
  );

  const spotCheck = useCallback(async () => {
    const paths = parsePaths(batchUrls);
    if (!paths.length) {
      toast({ variant: 'destructive', title: 'Spot check', description: 'Enter at least one path.' });
      return;
    }
    setBusy('spot');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/search-engines/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'spot-check', paths }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Spot check failed');
      setSpotPages((body.pages ?? []) as SpotPage[]);
      setLastAction({
        label: 'Page SEO spot check',
        ok: true,
        message: `Checked ${body.checked} page(s) against ${body.origin}.`,
      });
    } catch (e) {
      toastError('Spot check failed', e);
    } finally {
      setBusy(null);
    }
  }, [batchUrls, parsePaths, authHeaders, toast, toastError]);

  const engines = status?.engines ?? [];
  const byId = (id: string) => engines.find((e) => e.id === id);
  const google = byId('google');
  const bing = byId('bing');
  const yandex = byId('yandex');
  const indexnow = byId('indexnow');
  const indexnowReady = indexnow?.status === 'connected';
  const bingReady = Boolean(bing?.configured);
  const gscReady = Boolean(google?.configured);

  if (loading && !status) {
    return (
      <AdminLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Probing search engine surfaces…
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-black uppercase tracking-tight">
              <Globe className="h-6 w-6 text-primary" />
              Search Engine Center
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Verification, sitemap and URL submission for Google, Bing, Yandex and IndexNow.
              Every status below was checked on this request — nothing is reported as successful
              because it is merely configured.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => {
                void (async () => {
                  setBusy('refresh');
                  await Promise.all([loadStatus(true), loadHistory()]);
                  setBusy(null);
                })();
              }}
            >
              {busy === 'refresh' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-check (live)
            </Button>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void loadStatus()}>
              Refresh
            </Button>
          </div>
        </div>

        {failed && (
          <Card className="border-red-500/50">
            <CardContent className="py-4 text-sm text-red-400">
              Status could not be loaded. The server could not probe this deployment&apos;s public
              origin — fix the deployment, then hit Refresh.
            </CardContent>
          </Card>
        )}

        {/* ── Overview strip ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {engines.map((engine) => (
            <Card key={engine.id} className="border-border/70 bg-card/60">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {engine.label}
                </CardDescription>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="truncate">{engine.id}</span>
                  <StatusBadge status={engine.status} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs leading-relaxed text-muted-foreground">
                {engine.detail}
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="submission">Submission</TabsTrigger>
            <TabsTrigger value="seo">SEO checks</TabsTrigger>
            <TabsTrigger value="activity">Activity &amp; logs</TabsTrigger>
          </TabsList>

          {/* ── 1 · Overview ───────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {engines.map((engine) => (
                <Card key={engine.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{engine.label}</CardTitle>
                      <StatusBadge status={engine.status} />
                    </div>
                    <CardDescription>{engine.detail}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-2">
                      {engine.checks.map((check) => (
                        <li key={check.label} className="flex gap-2 text-sm">
                          <CheckIcon state={check.state} />
                          <div>
                            <p className="font-medium">{check.label}</p>
                            <p className="text-xs text-muted-foreground">{check.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="rounded-md border border-border/70 bg-muted/40 p-2 text-xs">
                      <p className="font-bold uppercase tracking-wider text-muted-foreground">
                        Credentials read (names only)
                      </p>
                      <p className="mt-1 break-all font-mono">
                        {engine.requiredEnvVars.length
                          ? engine.requiredEnvVars.join(', ')
                          : 'none — this engine needs no secret, only a public file'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">SEO surface snapshot</CardTitle>
                <CardDescription>
                  Probed {status ? isoShort(status.checkedAt) : '—'} on {status?.origin ?? '—'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">robots.txt</p>
                  <p className={`mt-1 text-sm ${status?.seo.robots.ok ? 'text-green-400' : 'text-amber-300'}`}>
                    {status?.seo.robots.ok ? 'Serving' : 'Problem'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{status?.seo.robots.detail}</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">sitemap.xml</p>
                  <p className={`mt-1 text-sm ${status?.seo.sitemap.ok ? 'text-green-400' : 'text-amber-300'}`}>
                    {status?.seo.sitemap.ok
                      ? `${status.seo.sitemap.urlCount} URLs`
                      : 'Problem'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{status?.seo.sitemap.detail}</p>
                </div>
                <div className="rounded-md border border-border/70 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Canonical origin</p>
                  <p className={`mt-1 text-sm ${status?.seo.canonical.matchesOrigin ? 'text-green-400' : 'text-amber-300'}`}>
                    {status?.seo.canonical.present ? 'Declared' : 'Missing'}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{status?.seo.canonical.detail}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 2 · Verification ───────────────────────────────── */}
          <TabsContent value="verification" className="mt-4 space-y-4">
            <Card className="border-amber-500/40">
              <CardContent className="flex gap-3 py-4 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-muted-foreground">
                  Verification codes are read from the deployment itself — this console never
                  rewrites them. To change a code, replace the file/tag in the repository and
                  deploy; the checks below will confirm the new code is being served.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Bing Webmaster Tools</CardTitle>
                    {bing && <StatusBadge status={bing.status} />}
                  </div>
                  <CardDescription>HTML meta tag on the home page</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required URL</p>
                    <p className="mt-1 flex items-center break-all font-mono text-xs">
                      {bing?.artifactUrl ? `${status?.origin ?? ''}${bing.artifactUrl}` : 'tag not served'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{bing?.detail}</p>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Credentials
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">{bing?.requiredEnvVars.join(', ')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Yandex Webmaster</CardTitle>
                    {yandex && <StatusBadge status={yandex.status} />}
                  </div>
                  <CardDescription>HTML file at the site root</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required URL</p>
                    <p className="mt-1 flex items-center break-all font-mono text-xs">
                      {yandex?.artifactUrl ? (
                        <a
                          className="flex items-center gap-1 underline underline-offset-2 hover:text-primary"
                          href={yandex.artifactUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {`${status?.origin ?? ''}${yandex.artifactUrl}`} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        'no yandex_*.html file in public/'
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{yandex?.detail}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Google Search Console</CardTitle>
                    {google && <StatusBadge status={google.status} />}
                  </div>
                  <CardDescription>HTML meta tag + optional official API check</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required URL</p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {google?.artifactUrl ? `${status?.origin ?? ''}${google.artifactUrl}` : 'tag not served'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{google?.detail}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null || !gscReady}
                    onClick={() => void loadStatus(true)}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Run live URL Inspection
                  </Button>
                  {!gscReady && (
                    <p className="text-xs text-amber-300">
                      Disabled: the GOOGLE_SEARCH_CONSOLE_* credentials are absent, so a live call
                      would only fail.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">IndexNow</CardTitle>
                    {indexnow && <StatusBadge status={indexnow.status} />}
                  </div>
                  <CardDescription>Key file at the host root</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-md border border-border/70 bg-muted/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required URL</p>
                    <p className="mt-1 flex items-center break-all font-mono text-xs">
                      <a
                        className="flex items-center gap-1 underline underline-offset-2 hover:text-primary"
                        href={indexnow?.artifactUrl ?? '/indexnow-key.txt'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {`${status?.origin ?? ''}${indexnow?.artifactUrl ?? '/indexnow-key.txt'}`}{' '}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{indexnow?.detail}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── 3 · Submission ─────────────────────────────────── */}
          <TabsContent value="submission" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4 text-primary" /> Sitemap submission
                  </CardTitle>
                  <CardDescription>
                    Puts the public sitemap into Google Search Console (official Webmasters API).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border border-border/70 bg-muted/40 p-3 font-mono text-xs break-all">
                    {status ? `${status.configuredOrigin}/sitemap.xml` : '—'}
                  </div>
                  <Button
                    size="sm"
                    disabled={busy !== null || !gscReady}
                    onClick={() => void runAction('sitemap', 'Sitemap submitted', { action: 'sitemap' })}
                  >
                    {busy === 'sitemap' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit sitemap
                  </Button>
                  {!gscReady && (
                    <p className="text-xs text-amber-300">
                      Disabled: the four GOOGLE_SEARCH_CONSOLE_* credentials are absent.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" /> IndexNow batch
                  </CardTitle>
                  <CardDescription>
                    Notifies Bing, Yandex, DuckDuckGo and Seznam that these URLs changed. Product and
                    shop create/edit flows already ping this way automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="indexnow-urls" className="text-xs uppercase tracking-wider">
                      Site-relative paths (one per line, max 10)
                    </Label>
                    <Textarea
                      id="indexnow-urls"
                      rows={4}
                      value={batchUrls}
                      onChange={(e) => setBatchUrls(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy !== null || !indexnowReady}
                    onClick={() =>
                      void runAction('indexnow', 'IndexNow submission', {
                        action: 'indexnow',
                        paths: parsePaths(batchUrls),
                      })
                    }
                  >
                    {busy === 'indexnow' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit to IndexNow
                  </Button>
                  {!indexnowReady && (
                    <p className="text-xs text-amber-300">
                      Disabled: INDEXNOW_ENABLED is not true in this environment (the key file is
                      checked above).
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4 text-primary" /> Manual URL → Bing
                  </CardTitle>
                  <CardDescription>
                    Bing&apos;s official SubmitUrl API — one URL per submission, rate-limited by the
                    engine&apos;s own quotas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="bing-url" className="text-xs uppercase tracking-wider">
                      Site-relative path
                    </Label>
                    <Input
                      id="bing-url"
                      value={singleUrl}
                      onChange={(e) => setSingleUrl(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy !== null || !bingReady}
                    onClick={() =>
                      void runAction('bing', 'Bing URL submission', {
                        action: 'bing',
                        paths: parsePaths(singleUrl).slice(0, 1),
                      })
                    }
                  >
                    {busy === 'bing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Submit URL
                  </Button>
                  {!bingReady && (
                    <p className="text-xs text-amber-300">
                      Disabled: BING_WEBMASTER_API_KEY / BING_WEBMASTER_SITE_URL are absent.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileSearch className="h-4 w-4 text-primary" /> Google URL Inspection
                  </CardTitle>
                  <CardDescription>
                    Reads Google&apos;s real index verdict for one URL. Google publishes no
                    official &quot;please index this&quot; API for arbitrary pages, so this is a
                    read — never a submission.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="inspect-url" className="text-xs uppercase tracking-wider">
                      Site-relative path
                    </Label>
                    <Input
                      id="inspect-url"
                      value={singleUrl}
                      onChange={(e) => setSingleUrl(e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={busy !== null || !gscReady}
                    onClick={() =>
                      void runAction('inspect', 'URL inspection', {
                        action: 'inspect',
                        paths: parsePaths(singleUrl).slice(0, 1),
                      })
                    }
                  >
                    {busy === 'inspect' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                    Inspect
                  </Button>
                  {!gscReady && (
                    <p className="text-xs text-amber-300">
                      Disabled: the GOOGLE_SEARCH_CONSOLE_* credentials are absent.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {lastAction && (
              <Card className={lastAction.ok ? 'border-green-500/40' : 'border-amber-500/40'}>
                <CardContent className="py-4 text-sm">
                  <p className="font-bold uppercase tracking-wider">{lastAction.label}</p>
                  <p className="mt-1 text-muted-foreground">{lastAction.message}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Automatic notifications</CardTitle>
                <CardDescription>
                  Already live in the codebase — no manual step required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  • Product create/edit (<code className="text-xs">/api/products/sync</code>) and
                  shop sync (<code className="text-xs">/api/shops/sync</code>) ping IndexNow for
                  the public URL.
                </p>
                <p>
                  • Video Studio publish pings the new product URL. Listings that go private or
                  get deleted are dropped by the shared private-path guard, and the distribution
                  engine&apos;s reconcile pass re-checks every public URL against the sitemap.
                </p>
                <p className="text-xs">
                  Fires only when <code className="text-xs">INDEXNOW_ENABLED=true</code>; each ping
                  is fire-and-forget with a 5s cap, so a search-engine hiccup never blocks a
                  publish.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 4 · SEO checks ─────────────────────────────────── */}
          <TabsContent value="seo" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Indexing readiness</CardTitle>
                <CardDescription>
                  Derived from the live robots.txt, sitemap and home page of {status?.origin ?? '—'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={status?.seo.robots.ok ? 'border-green-500/50 text-green-400' : 'border-amber-500/50 text-amber-300'}>
                    robots.txt {status?.seo.robots.ok ? 'OK' : 'needs attention'}
                  </Badge>
                  <Badge variant="outline" className={status?.seo.sitemap.ok ? 'border-green-500/50 text-green-400' : 'border-amber-500/50 text-amber-300'}>
                    sitemap.xml {status?.seo.sitemap.ok ? `OK · ${status.seo.sitemap.urlCount} URLs` : 'needs attention'}
                  </Badge>
                  <Badge variant="outline" className={status?.seo.sitemap.productUrls ? 'border-green-500/50 text-green-400' : 'border-amber-500/50 text-amber-300'}>
                    {status?.seo.sitemap.productUrls ?? 0} product URLs
                  </Badge>
                  <Badge variant="outline" className={status?.seo.sitemap.shopUrls ? 'border-green-500/50 text-green-400' : 'border-amber-500/50 text-amber-300'}>
                    {status?.seo.sitemap.shopUrls ?? 0} shop URLs
                  </Badge>
                  <Badge variant="outline" className={status?.seo.canonical.matchesOrigin ? 'border-green-500/50 text-green-400' : 'border-amber-500/50 text-amber-300'}>
                    canonical {status?.seo.canonical.matchesOrigin ? 'consistent' : 'mismatch'}
                  </Badge>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>robots.txt: {status?.seo.robots.detail}</li>
                  <li>sitemap.xml: {status?.seo.sitemap.detail}</li>
                  <li>canonical: {status?.seo.canonical.detail}</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Page SEO spot check</CardTitle>
                <CardDescription>
                  Reads up to 5 public pages and reports title, meta description, canonical and
                  noindex problems. Read-only GETs against the configured origin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="spot-urls" className="text-xs uppercase tracking-wider">
                    Paths (one per line, max 5)
                  </Label>
                  <Textarea
                    id="spot-urls"
                    rows={3}
                    value={batchUrls}
                    onChange={(e) => setBatchUrls(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <Button size="sm" disabled={busy !== null} onClick={() => void spotCheck()}>
                  {busy === 'spot' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                  Check pages
                </Button>

                {spotPages && (
                  <div className="space-y-3">
                    {spotPages.map((page) => (
                      <div key={page.path} className="rounded-md border border-border/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-xs break-all">{page.path}</p>
                          <Badge
                            variant="outline"
                            className={
                              page.ok && !page.issues.length
                                ? 'border-green-500/50 text-green-400'
                                : 'border-amber-500/50 text-amber-300'
                            }
                          >
                            {page.ok ? `HTTP ${page.status}` : 'unreachable'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm">
                          {page.title ?? <span className="text-red-400">no title</span>}
                          {page.title ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({page.titleLength} chars)
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {page.metaDescription ? 'meta description present' : 'no meta description'}
                          {page.canonical ? ` · canonical ${page.canonical}` : ' · no canonical'}
                          {page.robots ? ` · robots "${page.robots}"` : ''}
                        </p>
                        {page.issues.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs text-amber-300">
                            {page.issues.map((issue) => (
                              <li key={issue}>• {issue}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 5 · Activity ───────────────────────────────────── */}
          <TabsContent value="activity" className="mt-4 space-y-4">
            {history?.store === 'unavailable' && (
              <Card className="border-amber-500/40">
                <CardContent className="flex gap-3 py-4 text-sm text-muted-foreground">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  {history.storeNote}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last engine run</p>
                <p className="mt-1 font-mono text-sm">{isoShort(history?.engine?.lastRunAt ?? null)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last sitemap submission</p>
                <p className="mt-1 font-mono text-sm">{isoShort(history?.engine?.sitemapSubmittedAt ?? null)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last successful submission</p>
                <p className="mt-1 font-mono text-sm">
                  {history?.summary.lastSuccess ? isoShort(history.summary.lastSuccess.at) : '—'}
                </p>
                {history?.summary.lastSuccess && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {history.summary.lastSuccess.channel} · HTTP {history.summary.lastSuccess.responseStatus ?? '—'}
                  </p>
                )}
              </Card>
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last submission error</p>
                <p className="mt-1 font-mono text-sm">
                  {history?.summary.lastError ? isoShort(history.summary.lastError.at) : 'none recorded'}
                </p>
                {history?.summary.lastError && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {history.summary.lastError.channel} · {history.summary.lastError.message ?? history.summary.lastError.outcome}
                  </p>
                )}
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submission history</CardTitle>
                <CardDescription>
                  Newest first, from the distribution engine&apos;s own bounded submission log —
                  HTTP status and sanitized notes only, never response bodies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {history && history.jobs.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No submission attempts recorded yet.
                  </p>
                )}
                {history?.jobs.map((job) => (
                  <div key={job.id} className="rounded-md border border-border/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs break-all">{job.url ?? job.id}</p>
                      <Badge variant="outline" className="uppercase">{job.channel}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      status {job.status} · updated {isoShort(job.updatedAt)}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {job.submissions.length === 0 && (
                        <li className="text-muted-foreground">No attempts yet.</li>
                      )}
                      {job.submissions.map((sub, i) => (
                        <li key={`${job.id}-${i}`} className="flex flex-wrap gap-2">
                          <span className="font-mono">{isoShort(sub.at)}</span>
                          <span
                            className={
                              sub.outcome === 'accepted'
                                ? 'text-green-400'
                                : sub.outcome === 'error' || sub.outcome === 'rejected'
                                  ? 'text-red-400'
                                  : 'text-amber-300'
                            }
                          >
                            {sub.outcome}
                            {sub.responseStatus ? ` HTTP ${sub.responseStatus}` : ''}
                          </span>
                          {sub.message && <span className="text-muted-foreground">{sub.message}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audit trail</CardTitle>
                <CardDescription>Engine runs, config changes and manual submissions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {history && history.audit.length === 0 && (
                  <p className="text-sm text-muted-foreground">No audit entries yet.</p>
                )}
                {history?.audit
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div key={entry.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2 text-xs last:border-0">
                      <div>
                        <p className="font-bold uppercase tracking-wider">{entry.action.replace(/_/g, ' ')}</p>
                        {entry.detail && <p className="text-muted-foreground">{entry.detail}</p>}
                      </div>
                      <div className="text-right text-muted-foreground">
                        <p className="font-mono">{isoShort(entry.at)}</p>
                        {entry.destination && <p className="uppercase">{entry.destination}</p>}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
