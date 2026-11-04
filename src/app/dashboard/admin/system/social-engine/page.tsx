'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Unplug,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { MODULE_SPECS } from '@/lib/social-engine/modules';
import { moduleCapabilities } from '@/lib/social-engine/capabilities';
import type { ModuleReadiness, ReadinessState } from '@/lib/social-engine/types';

/**
 * SOCIAL ENGINE — administrator readiness dashboard.
 *
 * Everything rendered here comes from the admin API: real env-var presence
 * (names only), the caller's own connection, recorded test results and the
 * approval attestation. There is deliberately no optimistic state — a module
 * looks READY only after the server recorded a successful proving test, and a
 * handoff is always shown as "not a publish".
 *
 * The page never reads `process.env` and never receives a token or an upstream
 * error body, so nothing here can leak a credential.
 */

interface StatusResponse {
  modules: ModuleReadiness[];
  capabilities: { free: string[]; aiPoint: string[] };
  canonicalOrigin: string;
  generatedAt?: string;
}

const STATE_LABELS: Record<ReadinessState, string> = {
  NOT_CONFIGURED: 'Not configured',
  CONFIGURED: 'Needs authorization',
  CONNECTED: 'Connected',
  TESTED: 'Needs publish test',
  READY: 'Ready',
  APPROVAL_REQUIRED: 'Approval required',
  ERROR: 'Error',
};

/** One colour per state — a dot instead of a solid block keeps both themes readable. */
const STATE_DOT: Record<ReadinessState, string> = {
  NOT_CONFIGURED: 'bg-zinc-400',
  CONFIGURED: 'bg-amber-500',
  CONNECTED: 'bg-sky-500',
  TESTED: 'bg-indigo-500',
  READY: 'bg-emerald-500',
  APPROVAL_REQUIRED: 'bg-orange-500',
  ERROR: 'bg-red-500',
};

const STATE_BORDER: Record<ReadinessState, string> = {
  NOT_CONFIGURED: 'border-l-zinc-300',
  CONFIGURED: 'border-l-amber-400',
  CONNECTED: 'border-l-sky-400',
  TESTED: 'border-l-indigo-400',
  READY: 'border-l-emerald-500',
  APPROVAL_REQUIRED: 'border-l-orange-400',
  ERROR: 'border-l-red-500',
};

function when(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function StateBadge({ state }: { state: ReadinessState }) {
  return (
    <Badge variant="outline" className="shrink-0 gap-1.5 whitespace-nowrap font-medium">
      <span className={`h-2 w-2 rounded-full ${STATE_DOT[state] ?? 'bg-zinc-400'}`} />
      {STATE_LABELS[state] ?? state}
    </Badge>
  );
}

function TestLine({
  label,
  record,
}: {
  label: string;
  record?: { ok: boolean; at: string; note: string; remoteId?: string };
}) {
  if (!record) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span>Never run</span>
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-lg bg-muted/60 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className={`inline-flex items-center gap-1 font-semibold ${record.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {record.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {record.ok ? 'Passed' : 'Failed'}
        </span>
      </div>
      <p className="text-foreground/80">{record.note}</p>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>{when(record.at)}</span>
        {record.remoteId ? <span className="font-mono">id {record.remoteId}</span> : null}
      </div>
    </div>
  );
}

export default function SocialEnginePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Module whose neutral publish test is awaiting explicit confirmation. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit): Promise<Record<string, unknown>> => {
      if (!user) throw new Error('Not signed in.');
      const token = await user.getIdToken();
      const res = await fetch(path, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          (body.note as string) || (body.error as string) || `Request failed (HTTP ${res.status}).`,
        );
      }
      return body;
    },
    [user],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const body = (await call('/api/social-engine/status')) as unknown as StatusResponse;
      setData(body);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load status.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, call]);

  useEffect(() => {
    void load();
  }, [load]);

  // Surface the OAuth callback outcome without a full page reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) toast({ title: `${connected} connected`, description: 'Run Test to verify it.' });
    else if (error) toast({ variant: 'destructive', title: 'Connection failed', description: error });
    if (connected || error) window.history.replaceState({}, '', window.location.pathname);
  }, [toast]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const module of data?.modules ?? []) counts[module.state] = (counts[module.state] ?? 0) + 1;
    return counts;
  }, [data]);

  const run = useCallback(
    async (key: string, label: string, fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(key);
      try {
        await fn();
        toast({ title: label });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Action failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setBusy(null);
      }
    },
    [busy, toast],
  );

  const runTest = (module: string) =>
    run(`test:${module}`, 'Diagnostic complete', async () => {
      const body = await call(`/api/social-engine/${module}/test`, { method: 'POST' });
      const steps = (body.steps ?? []) as Array<{ ok?: boolean; note?: string }>;
      const last = steps[steps.length - 1];
      if (last?.note && last.ok === false) throw new Error(last.note);
      await load();
    });

  const runPublishTest = (module: string) =>
    run(`publish:${module}`, 'Publish test complete', async () => {
      const payload: Record<string, unknown> = { confirm: true };
      if (module === 'tiktok' && videoUrl.trim()) payload.videoUrl = videoUrl.trim();
      const body = await call(`/api/social-engine/${module}/publish-test`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setConfirming(null);
      setVideoUrl('');
      if (body.handoff === true) {
        toast({
          title: 'Handoff prepared — not a publish',
          description: (body.note as string) || 'Complete the upload on TikTok; it is recorded as a handoff.',
        });
      }
      await load();
    });

  const runDisconnect = (module: string) =>
    run(`disconnect:${module}`, 'Disconnected', async () => {
      await call(`/api/social-engine/${module}/disconnect`, { method: 'POST' });
      await load();
    });

  const runApproval = (module: string, granted: boolean) =>
    run(`approval:${module}`, granted ? 'Approval recorded' : 'Approval revoked', async () => {
      await call('/api/social-engine/approval', {
        method: 'POST',
        body: JSON.stringify({ module, granted }),
      });
      await load();
    });

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Copy the value manually.' });
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-5 pb-16">
        {/* Hero — black panel, coral rule: the Vidnov admin voice. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-zinc-950 text-white">
          <div className="h-1 w-full bg-primary" />
          <div className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="space-y-1">
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Social Engine
              </h1>
              <p className="max-w-2xl text-sm text-white/70">
                Every integration, its real state, and the one next step to make it live. Status comes from
                recorded tests — never from configuration alone.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['READY', 'Ready'],
            ['TESTED', 'Needs publish test'],
            ['APPROVAL_REQUIRED', 'Approval required'],
            ['NOT_CONFIGURED', 'Not configured'],
          ].map(([state, label]) => (
            <div key={state} className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="text-lg font-bold leading-tight">{summary[state] ?? 0}</div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Social Engine unavailable</p>
              <p className="text-red-700/80">{loadError}</p>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading integrations…
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.modules.map((module) => {
                const spec = MODULE_SPECS[module.id];
                const caps = moduleCapabilities(module.id);
                const missing = module.missingEnvVars;
                const isOauth = spec.connectionKind === 'oauth';
                const isPublishing = spec.readyBy === 'publish';
                const callback = `${data.canonicalOrigin}/api/social-engine/callback/${module.id}`;
                const testBusy = busy === `test:${module.id}`;

                return (
                  <Card
                    key={module.id}
                    className={`flex flex-col border-l-4 ${STATE_BORDER[module.state] ?? 'border-l-zinc-300'}`}
                  >
                    <CardHeader className="gap-2 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base leading-tight">{module.label}</CardTitle>
                          <CardDescription className="mt-1 line-clamp-3 text-xs">{module.purpose}</CardDescription>
                        </div>
                        <StateBadge state={module.state} />
                      </div>
                    </CardHeader>

                    <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                      {missing.length > 0 ? (
                        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <div>
                            <p className="font-semibold">Missing configuration</p>
                            <p className="font-mono break-all">{missing.join(', ')}</p>
                          </div>
                        </div>
                      ) : null}

                      {/* Connection + approval + publishing approval state */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/60 p-2">
                          <div className="text-muted-foreground">Account</div>
                          <div className={`font-semibold ${module.connection.connected ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {module.connection.connected ? 'Connected' : isOauth ? 'Not connected' : 'Server credentials'}
                          </div>
                          <div className="truncate text-muted-foreground">
                            {module.connection.accountLabel ?? (module.connection.disconnectedAt ? 'Disconnected' : '—')}
                          </div>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-2">
                          <div className="text-muted-foreground">Provider approval</div>
                          <div className={`font-semibold ${!module.approval.required || module.approval.granted ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {!module.approval.required ? 'Not required' : module.approval.granted ? 'Attested' : 'Pending'}
                          </div>
                          <div className="truncate text-muted-foreground">
                            {module.lastPublishTest?.ok ? 'Publish verified' : isPublishing ? 'No confirmed publish' : 'No publish surface'}
                          </div>
                        </div>
                      </div>

                      {module.approval.required && !module.approval.granted ? (
                        <p className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800">
                          {module.approval.note}
                        </p>
                      ) : null}

                      {/* Last results */}
                      <div className="space-y-1.5">
                        <TestLine label="Last auth test" record={module.lastAuthTest} />
                        <TestLine label="Last diagnostic" record={module.lastDiagnostic} />
                        {isPublishing || module.lastPublishTest ? (
                          <TestLine label="Last publish test" record={module.lastPublishTest} />
                        ) : null}
                      </div>

                      {module.lastHandoff ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                          <div className="flex items-center gap-1 font-semibold">
                            <Clock className="h-3 w-3" /> Handoff — not a published post
                          </div>
                          <p className="break-words">{module.lastHandoff.note}</p>
                          <p className="text-amber-700/70">{when(module.lastHandoff.at)}</p>
                        </div>
                      ) : null}

                      {module.lastError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                          <div className="flex items-center gap-1 font-semibold">
                            <AlertTriangle className="h-3 w-3" /> Last error
                          </div>
                          <p className="break-words">{module.lastError.note}</p>
                        </div>
                      ) : null}

                      {/* Capabilities */}
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-muted-foreground">Available capabilities</div>
                        <div className="flex flex-wrap gap-1">
                          {caps.free.map((cap) => (
                            <span
                              key={cap}
                              className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px]"
                            >
                              {cap}
                            </span>
                          ))}
                          {caps.aiPoint.map((cap) => (
                            <span
                              key={cap}
                              className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
                            >
                              {cap}
                            </span>
                          ))}
                          {caps.free.length === 0 && caps.aiPoint.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Next step */}
                      <div className="flex items-start gap-1.5 rounded-lg border border-border bg-muted/40 p-2 text-xs">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{module.nextStep}</span>
                      </div>

                      {/* Callback helper for OAuth modules */}
                      {isOauth ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="shrink-0">Callback</span>
                          <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono">{callback}</code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => void copy(callback, module.id)}
                            aria-label="Copy callback URL"
                          >
                            {copied === module.id ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      ) : null}

                      {/* Actions */}
                      <div className="mt-auto space-y-2 pt-1">
                        {confirming === module.id ? (
                          <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-2">
                            <p className="text-xs font-semibold text-foreground">
                              Send one neutral test message: “Vidnov integration test — safe to ignore.”
                            </p>
                            {module.id === 'tiktok' ? (
                              <input
                                value={videoUrl}
                                onChange={(event) => setVideoUrl(event.target.value)}
                                placeholder="Public HTTPS test video URL (required for video.publish)"
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                              />
                            ) : null}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                disabled={busy === `publish:${module.id}`}
                                onClick={() => void runPublishTest(module.id)}
                              >
                                {busy === `publish:${module.id}` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                Confirm publish test
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setConfirming(null);
                                  setVideoUrl('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void runTest(module.id)}
                              disabled={testBusy || missing.length > 0}
                            >
                              {testBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                              Test
                            </Button>

                            {isPublishing ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setConfirming(module.id)}
                                disabled={missing.length > 0 || (module.approval.required && !module.approval.granted)}
                              >
                                <Send className="h-3.5 w-3.5" />
                                Publish test
                              </Button>
                            ) : null}

                            {isOauth ? (
                              <Button
                                size="sm"
                                variant={module.connection.connected ? 'outline' : 'default'}
                                onClick={() => {
                                  if (!user) return;
                                  window.location.href = `/api/social-engine/${module.id}/connect`;
                                }}
                              >
                                <Plug className="h-3.5 w-3.5" />
                                {module.connection.connected ? 'Reconnect' : 'Connect'}
                              </Button>
                            ) : null}

                            {module.connection.connected ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => void runDisconnect(module.id)}
                                disabled={busy === `disconnect:${module.id}`}
                              >
                                <Unplug className="h-3.5 w-3.5" />
                                Disconnect
                              </Button>
                            ) : null}

                            {module.approval.required ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void runApproval(module.id, !module.approval.granted)}
                                disabled={busy === `approval:${module.id}`}
                              >
                                {module.approval.granted ? 'Revoke approval' : 'Attest approval'}
                              </Button>
                            ) : null}
                          </div>
                        )}

                        {spec.connectPath ? (
                          <a
                            href={spec.connectPath}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Existing connection flow
                          </a>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Capability catalogue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> Capability identifiers
                </CardTitle>
                <CardDescription>
                  Stable ids only — no prices and no point deductions are implemented in the Social Engine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Circle className="h-3 w-3 fill-emerald-500 text-emerald-500" /> Free
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.capabilities.free.map((cap) => (
                      <span key={cap} className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px]">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Circle className="h-3 w-3 fill-primary text-primary" /> AI Points (future pricing)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.capabilities.aiPoint.map((cap) => (
                      <span
                        key={cap}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="px-1 text-[11px] text-muted-foreground">
              Readiness states: not configured → needs credentials → needs authorization → connected → needs
              testing → ready, with “approval required” and “error” as side states. Last generated{' '}
              {when(data.generatedAt)}.
            </p>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
