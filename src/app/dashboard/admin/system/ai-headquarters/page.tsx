'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * VIDNOV AI HEADQUARTERS — Orbit console.
 *
 * Shows what actually exists: the honest model state (MODEL_NOT_CONFIGURED
 * until a real provider key is added), the department registry, the agents
 * Vidnov will accept calls from, and the proposal queue where every agent
 * request waits for a founder decision.
 *
 * Nothing here publishes, spends or deploys. Approving a proposal records the
 * decision (bound to the exact action digest); the action itself still runs
 * through its own guarded route, by a human.
 */

interface Agent {
  id: string;
  name: string;
  department: string;
  role: string;
  scopes: string[];
  tokenPrefix: string;
  enabled: boolean;
  createdAt: string;
  lastSeenAt?: string;
}

interface Proposal {
  id: string;
  kind: string;
  title: string;
  summary: string;
  action: { type: string; params: Record<string, unknown> };
  actionDigest: string;
  requestedBy: { agentId: string; name: string; department: string };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
}

interface Overview {
  model: { state: string; configured: boolean; provider?: string; model?: string; missing: string[]; note: string };
  departments: { id: string; label: string; responsibility: string; reportsTo: string }[];
  scopes: { id: string; label: string }[];
  agents: Agent[];
  proposals: Proposal[];
  audit: { action: string; actor: string; at: string; outcome: string; note?: string }[];
}

const KIND_LABEL: Record<string, string> = {
  campaign: 'Campaign',
  content: 'Social content',
  investigation: 'Investigation',
  publish: 'Publishing',
};

export default function AiHeadquartersPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [department, setDepartment] = useState('analytics');
  const [role, setRole] = useState('');
  const [scopes, setScopes] = useState<string[]>(['status:read', 'marketplace:read']);

  const call = useCallback(
    async (init?: { method: 'POST'; body: Record<string, unknown> }) => {
      if (!user) throw new Error('Sign in as an administrator.');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/ai-headquarters', {
        method: init?.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init ? { body: JSON.stringify(init.body) } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(String(body.message ?? body.error ?? `Request failed (${res.status}).`));
      }
      return body;
    },
    [user],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const body = (await call()) as unknown as Overview;
      setData(body);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the headquarters.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, call]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => (data?.proposals ?? []).filter((p) => p.status === 'pending'),
    [data],
  );

  async function createAgent() {
    if (!name.trim() || scopes.length === 0) {
      toast({ title: 'Missing details', description: 'A name and at least one scope are required.' });
      return;
    }
    setBusy('create');
    try {
      const body = await call({
        method: 'POST',
        body: { action: 'create_agent', name, department, role, scopes },
      });
      setIssuedToken(String(body.token ?? ''));
      setName('');
      setRole('');
      toast({ title: 'Agent registered', description: 'Copy the credential now — it is shown once.' });
      await load();
    } catch (error) {
      toast({
        title: 'Could not create the agent',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleAgent(agent: Agent) {
    setBusy(agent.id);
    try {
      await call({ method: 'POST', body: { action: 'set_agent_enabled', id: agent.id, enabled: !agent.enabled } });
      await load();
    } catch (error) {
      toast({
        title: 'Could not update the agent',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  async function decide(proposal: Proposal, decision: 'approve' | 'reject') {
    setBusy(proposal.id);
    try {
      await call({
        method: 'POST',
        body: { action: 'decide_proposal', id: proposal.id, decision, digest: proposal.actionDigest },
      });
      toast({
        title: decision === 'approve' ? 'Proposal approved' : 'Proposal rejected',
        description:
          decision === 'approve'
            ? 'Nothing ran. Run the action yourself through its normal admin route.'
            : 'The agent will see the rejection in Paperclip.',
      });
      await load();
    } catch (error) {
      toast({
        title: 'Decision not recorded',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  const model = data?.model;

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/15 text-primary">AI Headquarters</Badge>
            <Badge variant="outline">Orbit + Paperclip + Hermes</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orbit console</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Agents may read safe aggregates and prepare proposals. They cannot publish, spend, deploy
            or change credentials — every one of those is a founder decision.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/dashboard/admin/system/social-engine">
                Social Engine <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </header>

        {loadError && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <span>{loadError}</span>
            </CardContent>
          </Card>
        )}

        {issuedToken && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" /> Agent credential — shown once
              </CardTitle>
              <CardDescription>
                Paste it into Hermes/Paperclip now. Only a hash is stored, so it cannot be recovered.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <code className="block w-full overflow-x-auto rounded-md bg-muted p-3 text-xs">{issuedToken}</code>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(issuedToken);
                    toast({ title: 'Copied' });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIssuedToken(null)}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Model state */}
        <Card className={model?.configured ? 'border-emerald-500/40' : 'border-amber-500/40'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              {model?.configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              Model: {model?.state ?? 'unknown'}
            </CardTitle>
            <CardDescription>{model?.note ?? 'Reading model configuration…'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {model?.missing?.length ? (
              <p>
                Missing:{' '}
                <span className="font-mono text-xs">{model.missing.join(', ')}</span>
              </p>
            ) : null}
            {model?.provider ? (
              <p className="text-muted-foreground">
                Provider: {model.provider}
                {model.model ? ` · model ${model.model}` : ''}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Add the provider key to the server environment — never here, never in a proposal.
            </p>
          </CardContent>
        </Card>

        {/* Departments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> Departments
            </CardTitle>
            <CardDescription>Eight departments report to the Executive Office, which reports to you.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(data?.departments ?? []).map((dept) => (
              <div key={dept.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{dept.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dept.responsibility}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Agents */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4 text-primary" /> Registered agents
            </CardTitle>
            <CardDescription>
              Only these credentials are accepted by Orbit. A disabled agent is refused immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Agent name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                >
                  {(data?.departments ?? []).map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Role (e.g. growth analyst)"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {(data?.scopes ?? []).map((scope) => (
                  <label key={scope.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope.id)}
                      onChange={(event) =>
                        setScopes((current) =>
                          event.target.checked
                            ? [...current, scope.id]
                            : current.filter((item) => item !== scope.id),
                        )
                      }
                    />
                    {scope.label}
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={() => void createAgent()} disabled={busy === 'create'}>
                {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Register agent
              </Button>
            </div>

            {(data?.agents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agents yet. Register one, then paste its credential into Paperclip/Hermes.
              </p>
            ) : (
              <div className="space-y-2">
                {(data?.agents ?? []).map((agent) => (
                  <div key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {agent.name}{' '}
                        {agent.enabled ? (
                          <Badge className="ml-1 bg-emerald-500/15 text-emerald-600">enabled</Badge>
                        ) : (
                          <Badge variant="outline">disabled</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {agent.department} · {agent.scopes.join(', ')}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{agent.tokenPrefix}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={agent.enabled ? 'outline' : 'default'}
                      onClick={() => void toggleAgent(agent)}
                      disabled={busy === agent.id}
                    >
                      {busy === agent.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      {agent.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proposals */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" /> Proposals waiting for you
            </CardTitle>
            <CardDescription>
              Approving records your decision for the exact action shown. It never runs the action.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              pending.map((proposal) => (
                <div key={proposal.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{KIND_LABEL[proposal.kind] ?? proposal.kind}</Badge>
                    <span className="text-sm font-medium">{proposal.title}</span>
                  </div>
                  {proposal.summary ? (
                    <p className="text-xs text-muted-foreground">{proposal.summary}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {proposal.requestedBy.name} · {proposal.requestedBy.department} · action{' '}
                    <span className="font-mono">{proposal.action.type}</span>
                  </p>
                  <p className="break-all font-mono text-[10px] text-muted-foreground">
                    digest {proposal.actionDigest}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void decide(proposal, 'approve')} disabled={busy === proposal.id}>
                      {busy === proposal.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(proposal, 'reject')}
                      disabled={busy === proposal.id}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent decisions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.audit ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {(data?.audit ?? []).map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-2">
                    <span className="font-mono text-muted-foreground">{entry.at.slice(0, 16).replace('T', ' ')}</span>
                    <span className="font-medium">{entry.action.replace(/_/g, ' ')}</span>
                    <span className="text-muted-foreground">{entry.actor}</span>
                    {entry.note ? <span className="text-muted-foreground">— {entry.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
