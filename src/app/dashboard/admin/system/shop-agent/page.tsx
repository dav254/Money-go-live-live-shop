'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  Megaphone,
  MousePointerClick,
  PackagePlus,
  PlayCircle,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * Shop Opportunity Agent — the operational Control Center.
 *
 * Everything on this page is read from the admin API (server-computed scores,
 * honest provider states, real funnel counts). `null` counters render as "—",
 * never 0. Every action goes through a server-side admin gate; no API key or
 * secret is ever present in this file.
 */

type Count = number | null;

interface Criterion {
  id: string;
  label: string;
  weight: number;
  met: boolean;
  explanation: string;
}

interface Candidate {
  id: string;
  name: string;
  category: string;
  area: string | null;
  website: string | null;
  contact: { kind: string; value: string } | null;
  stage: string;
  suppression: { suppressed: boolean; reason?: string };
  eligibility: { score: number; maxScore: number; recommendation: string; criteria?: Criterion[] } | null;
  expiresAt: string;
  source: string;
  sourceAttribution: string;
}

interface MessageRow {
  id: string;
  candidateId: string;
  channel: string;
  state: string;
  attempts?: number;
  subject?: string;
  lastError?: { class: string; message: string } | null;
}

interface Campaign {
  paused: boolean;
  complianceAcknowledged: boolean;
  senderName: string;
  dailyMessageLimit: number;
  dailyBudgetMinor: number;
}

interface ProviderInfo {
  id: string;
  label: string;
  status: string;
  requiredEnvVars: string[];
  note: string;
}

interface Overview {
  campaign: Campaign;
  funnel: {
    stages: { perStage: Record<string, Count> };
    messages: { perState: Record<string, Count> };
    suppression: { optOuts: Count };
    attribution: { campaignViews: Count; campaignClicks: Count; attributedOrders: Count };
    downstream: Record<string, Count>;
    notes: string[];
    truncated?: boolean;
  };
  providers: Record<string, ProviderInfo>;
}

const STAGE_LABELS: Array<[string, string]> = [
  ['discovered', 'Discovered'],
  ['eligible', 'Eligible'],
  ['invitation_approved', 'Invitation approved'],
  ['message_sent', 'Message sent'],
  ['replied', 'Replied'],
  ['onboarding', 'Onboarding'],
  ['registered', 'Registered'],
  ['shop_published', 'Shop published'],
  ['product_published', 'Product published'],
];

const STATE_LABELS: Record<string, string> = {
  pending_approval: 'Awaiting approval',
  approved: 'Approved',
  sending: 'Sending',
  sent: 'Sent (accepted)',
  dev_captured: 'Dev-captured (not sent)',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** `null` means unknown — never render it as 0. */
function count(value: Count): string {
  return value === null || value === undefined ? '—' : String(value);
}

export default function ShopAgentPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const call = useCallback(
    async (path: string, init?: RequestInit): Promise<unknown> => {
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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Request failed.');
      return body;
    },
    [user],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ov, cands, msgs] = await Promise.all([
        call('/api/admin/shop-agent/overview') as Promise<Overview>,
        call('/api/admin/shop-agent/candidates?limit=100') as Promise<{ candidates: Candidate[] }>,
        call('/api/admin/shop-agent/messages?limit=50') as Promise<{ messages: MessageRow[] }>,
      ]);
      setOverview(ov);
      setCandidates(cands.candidates ?? []);
      setMessages(msgs.messages ?? []);
      setSelected([]);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Shop Opportunity Agent unavailable',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [user, call, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = useCallback(
    async (label: string, run: () => Promise<unknown>, reload = true) => {
      setBusy(true);
      try {
        const result = await run();
        toast({ title: label, description: undefined });
        if (reload) await load();
        return result;
      } catch (e) {
        toast({
          variant: 'destructive',
          title: label + ' failed',
          description: e instanceof Error ? e.message : 'Unknown error',
        });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load, toast],
  );

  const runScout = () =>
    action('Scout run', async () => {
      const body = (await call('/api/admin/shop-agent/scout', {
        method: 'POST',
        body: JSON.stringify({ action: 'places', limit: 20 }),
      })) as { status: string; added?: number; duplicates?: number; message?: string };
      if (body.status !== 'ok') {
        toast({ title: 'Scout did not run', description: body.message ?? body.status });
        return body;
      }
      return body;
    });

  const patchCandidate = (id: string, payload: Record<string, unknown>, label: string) =>
    action(label, () =>
      call(`/api/admin/shop-agent/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    );

  const patchCampaign = (payload: Record<string, unknown>, label: string) =>
    action(label, () =>
      call('/api/admin/shop-agent/campaign', { method: 'POST', body: JSON.stringify(payload) }),
    );

  const messageAction = (act: 'approve' | 'reject' | 'send', ids?: string[], limit?: number) =>
    action(`${act} messages`, () =>
      call('/api/admin/shop-agent/messages', {
        method: 'POST',
        body: JSON.stringify({ action: act, ids, limit }),
      }),
    );

  const campaign = overview?.campaign;
  const providers = overview ? Object.values(overview.providers) : [];
  const funnel = overview?.funnel;
  const pending = messages.filter((m) => m.state === 'pending_approval');

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <Rocket className="h-6 w-6 text-primary" /> Shop Opportunity Agent
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Discover · analyze · approve outreach · onboard sellers · measure
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={runScout} disabled={busy || !user}>
              <Building2 className="mr-2 h-4 w-4" /> Run scout (20)
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || !user}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Campaign controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Campaign controls
            </CardTitle>
            <CardDescription>
              Messaging starts paused and unacknowledged. Sending requires this switch, the compliance
              acknowledgement, AND per-message approval — three independent gates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={campaign?.paused ? 'destructive' : 'default'}>
                {campaign?.paused === false ? 'Messaging active' : 'Messaging paused'}
              </Badge>
              <Badge variant={campaign?.complianceAcknowledged ? 'default' : 'outline'}>
                {campaign?.complianceAcknowledged ? 'Compliance acknowledged' : 'Compliance not acknowledged'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Daily limit: {campaign?.dailyMessageLimit ?? '—'} · Daily budget: KES{' '}
                {((campaign?.dailyBudgetMinor ?? 0) / 100).toFixed(2)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={campaign?.paused ? 'default' : 'destructive'}
                disabled={busy || !campaign}
                onClick={() => patchCampaign({ paused: !campaign?.paused }, 'Campaign toggled')}
              >
                {campaign?.paused ? (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" /> Resume messaging
                  </>
                ) : (
                  <>
                    <Ban className="mr-2 h-4 w-4" /> Pause messaging
                  </>
                )}
              </Button>
              {!campaign?.complianceAcknowledged && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !campaign}
                  onClick={() =>
                    patchCampaign({ complianceAcknowledged: true }, 'Compliance acknowledged')
                  }
                >
                  Acknowledge outreach compliance
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Providers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" /> Integrations & AI providers
            </CardTitle>
            <CardDescription>
              Status reflects real configuration — a key existing is reported as configured, never as
              connected.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <div key={p.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{p.label}</p>
                  <Badge variant={p.status === 'configured' ? 'default' : 'outline'}>{p.status}</Badge>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground" title={p.note}>
                  {p.note}
                </p>
                {p.requiredEnvVars.length > 0 && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Needs: {p.requiredEnvVars.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-4 w-4" /> Acquisition funnel
            </CardTitle>
            <CardDescription>
              “—” means unknown, never zero. Visits/clicks come from the tracked campaign links
              (?camp=shopagent); enquiries, orders and completed sales have no campaign-level join yet
              and stay unknown on purpose.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {STAGE_LABELS.map(([key, label]) => (
                <div key={key} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-xl font-black" title="null = unknown">
                    {count(funnel?.stages?.perStage?.[key] ?? null)}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Campaign views
                </p>
                <p className="text-xl font-black">{count(funnel?.attribution?.campaignViews ?? null)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Campaign clicks
                </p>
                <p className="text-xl font-black">{count(funnel?.attribution?.campaignClicks ?? null)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Attributed orders
                </p>
                <p className="text-xl font-black">{count(funnel?.attribution?.attributedOrders ?? null)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Opt-outs
                </p>
                <p className="text-xl font-black">{count(funnel?.suppression?.optOuts ?? null)}</p>
              </div>
            </div>
            <div className="space-y-1">
              {(funnel?.notes ?? []).map((note) => (
                <p key={note} className="text-[11px] text-muted-foreground">
                  • {note}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Messages queue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Outreach queue
              {pending.length > 0 && <Badge className="ml-2">{pending.length} awaiting approval</Badge>}
            </CardTitle>
            <CardDescription>
              Human review before anything sends. “Dev-captured” means the mail was captured in
              development mode — it was NOT delivered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy || selected.length === 0}
                onClick={() => {
                  void messageAction('approve', selected).then(() => setSelected([]));
                }}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || selected.length === 0}
                onClick={() => {
                  void messageAction('reject', selected).then(() => setSelected([]));
                }}
              >
                <XCircle className="mr-2 h-4 w-4" /> Reject selected
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || messages.length === 0}
                onClick={() => void messageAction('send', undefined, 10)}
              >
                <Send className="mr-2 h-4 w-4" /> Send approved batch (max 10)
              </Button>
            </div>
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No messages yet — create a package from an eligible candidate below.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                {m.state === 'pending_approval' && (
                  <input
                    type="checkbox"
                    aria-label={`Select message ${m.id}`}
                    checked={selected.includes(m.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                      )
                    }
                    className="h-4 w-4"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{m.subject || m.id}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.channel} · {m.candidateId.slice(0, 12)}… · attempts {m.attempts ?? 0}
                    {m.lastError ? ` · last error: ${m.lastError.class}` : ''}
                  </p>
                </div>
                <Badge variant={m.state === 'failed' ? 'destructive' : 'secondary'}>
                  {STATE_LABELS[m.state] ?? m.state}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Candidates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Candidates ({candidates.length})
            </CardTitle>
            <CardDescription>
              Server-computed scores with per-criterion explanations. Approval is refused unless the
              rubric says eligible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {candidates.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">
                No candidates yet — run the scout to search the pilot area.
              </p>
            )}
            {candidates.map((c) => (
              <div key={c.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{c.name}</p>
                  <Badge variant="outline">{c.category}</Badge>
                  <Badge variant="secondary">{c.stage.replace(/_/g, ' ')}</Badge>
                  {c.suppression.suppressed && (
                    <Badge variant="destructive">suppressed ({c.suppression.reason ?? 'unknown'})</Badge>
                  )}
                  {c.eligibility && (
                    <Badge
                      variant={
                        c.eligibility.recommendation === 'eligible'
                          ? 'default'
                          : c.eligibility.recommendation === 'needs_review'
                            ? 'secondary'
                            : 'destructive'
                      }
                    >
                      {c.eligibility.recommendation} · {c.eligibility.score}/{c.eligibility.maxScore}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    source: {c.sourceAttribution} · expires {c.expiresAt.slice(0, 10)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 px-2"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    {expanded === c.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => patchCandidate(c.id, { action: 'approve' }, 'Candidate approved')}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => patchCandidate(c.id, { action: 'reject' }, 'Candidate rejected')}
                  >
                    <XCircle className="mr-1 h-4 w-4" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      action('Package generated', () =>
                        call('/api/admin/shop-agent/packages', {
                          method: 'POST',
                          body: JSON.stringify({ action: 'generate', candidateId: c.id }),
                        }),
                      )
                    }
                  >
                    <PackagePlus className="mr-1 h-4 w-4" /> Package
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      action('Poster generated', () =>
                        call('/api/admin/shop-agent/packages', {
                          method: 'POST',
                          body: JSON.stringify({ action: 'poster', candidateId: c.id, confirm: true }),
                        }),
                      )
                    }
                  >
                    <Sparkles className="mr-1 h-4 w-4" /> Poster
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || c.stage === 'discovered' || c.stage === 'rejected'}
                    onClick={() =>
                      patchCandidate(c.id, { action: 'suppress', reason: 'manual' }, 'Contact suppressed')
                    }
                  >
                    <Ban className="mr-1 h-4 w-4" /> Suppress
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => patchCandidate(c.id, { action: 'analyze' }, 'Analysis recomputed')}
                  >
                    <Megaphone className="mr-1 h-4 w-4" /> Analyze
                  </Button>
                </div>

                {expanded === c.id && (
                  <div className="space-y-3 border-t border-border/60 pt-3">
                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <p>
                        Area: {c.area ?? '—'} · Contact: {c.contact ? `${c.contact.kind}` : 'none'} ·{' '}
                        {c.website ? (
                          <span className="truncate">{c.website}</span>
                        ) : (
                          'no website in source'
                        )}
                      </p>
                    </div>
                    {c.eligibility?.criteria?.map((crit) => (
                      <div key={crit.id} className="flex items-start gap-2 text-xs">
                        <span className={crit.met ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                          {crit.met ? '✓' : '✗'}
                        </span>
                        <span>
                          <span className="font-semibold">{crit.label}</span> ({crit.weight}) —{' '}
                          {crit.explanation}
                        </span>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Advance stage for ${c.name}`}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        defaultValue=""
                        onChange={(e) => {
                          const to = e.target.value;
                          if (to) {
                            void patchCandidate(c.id, { action: 'advance', stage: to }, `Stage → ${to}`);
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="" disabled>
                          Advance stage…
                        </option>
                        {STAGE_LABELS.map(([key, label]) => (
                          <option key={key} value={key} disabled={key === c.stage}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <UserPlus className="h-3 w-3" /> registered/shop/product stages require verified
                        account evidence
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
