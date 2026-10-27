'use client';

/**
 * Admin opportunity review — a thin consumer of /api/admin/opportunities.
 *
 * GET  lists applications for one review state (bounded by the API);
 * PUT  sends an explicit approve/reject decision for ONE application.
 *
 * Everything the server decides stays server-side: the reviewer uid is taken
 * from the verified token, transitions are validated there (a conflicting or
 * repeated decision comes back 409 / `changed:false`), and an approval
 * records an outcome EVENT only — no money moves, no ledger entry, no payout.
 * A response with `eventRecorded:false` means the decision committed but the
 * outcome event could not be written; it is surfaced, never hidden, and is
 * not a reason to re-send the decision.
 */

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, RefreshCw, XCircle } from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

type ApplicationState = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn';

interface Application {
  id: string;
  opportunityId?: string;
  applicantUid?: string;
  state?: ApplicationState;
  note?: string | null;
  reviewReason?: string | null;
  createdAt?: { toMillis?: () => number } | string | null;
  reviewedAt?: { toMillis?: () => number } | string | null;
}

const STATE_TABS: Array<{ value: string; label: string }> = [
  { value: 'submitted', label: 'Awaiting review' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/** States in which THIS interface may send a decision (server re-checks). */
const DECIDABLE: ApplicationState[] = ['submitted', 'under_review'];

const STATE_BADGE: Record<ApplicationState, string> = {
  submitted: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
  under_review: 'bg-sky-500/15 text-sky-500 border-sky-500/40',
  approved: 'bg-green-500/15 text-green-500 border-green-500/40',
  rejected: 'bg-red-500/15 text-red-500 border-red-500/40',
  withdrawn: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/40',
};

function toIso(value: Application['createdAt']): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  return '';
}

function formatWhen(value: Application['createdAt']): string {
  const iso = toIso(value);
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : '—';
}

/** The id the server will accept: `<opportunityId>__<uid>` (see applicationDocId). */
function shortId(id: string): string {
  const [opp, uid] = id.split('__');
  return `${opp ?? id}${uid ? ` · ${uid.slice(0, 8)}…` : ''}`;
}

export default function AdminOpportunityReviewPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [state, setState] = useState<string>('submitted');
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (target: string) => {
      if (!user) return;
      setLoading(true);
      setFailed(false);
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/admin/opportunities?state=${encodeURIComponent(target)}&limit=25`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as {
          items?: Application[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || 'Failed to load applications');
        setItems(Array.isArray(body.items) ? body.items : []);
      } catch (e) {
        setFailed(true);
        toast({
          variant: 'destructive',
          title: 'Review queue unavailable',
          description: e instanceof Error ? e.message : 'Unknown error',
        });
      } finally {
        setLoading(false);
      }
    },
    [user, toast],
  );

  useEffect(() => {
    load(state);
  }, [load, state]);

  const decide = async (applicationId: string, decision: 'approved' | 'rejected') => {
    if (!user || busyId) return;
    setBusyId(applicationId);
    try {
      const token = await user.getIdToken();
      const reason = (reasons[applicationId] ?? '').trim();
      const res = await fetch('/api/admin/opportunities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicationId, decision, ...(reason ? { reason } : {}) }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        changed?: boolean;
        eventRecorded?: boolean;
      };
      if (!res.ok) throw new Error(body.error || 'The review could not be recorded.');

      if (body.changed === false) {
        toast({ title: 'Already decided', description: 'This application already holds that decision.' });
      } else if (body.eventRecorded === false) {
        toast({
          variant: 'destructive',
          title: `${decision === 'approved' ? 'Approved' : 'Rejected'} — event not recorded`,
          description:
            'The decision was saved, but the outcome event could not be written. Do not re-send it.',
        });
      } else {
        toast({ title: `Application ${decision}`, description: 'Decision recorded and audited.' });
      }
      setReasons((prev) => ({ ...prev, [applicationId]: '' }));
      await load(state);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Review failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-primary" /> Opportunity Review
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Approve or reject applications · approvals record an event only, never a payout
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(state)} disabled={loading || !user}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <Tabs value={state} onValueChange={setState}>
          <TabsList className="bg-neutral-900 border-neutral-800 h-auto flex-wrap">
            {STATE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-primary">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {failed && !loading && (
          <Card className="border-destructive/40">
            <CardContent className="py-6 text-sm text-muted-foreground">
              The review API did not respond. No decision is sent optimistically — retry when the
              server is reachable.
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {!loading && items.length === 0 && !failed && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing in this queue.
            </CardContent>
          </Card>
        )}

        {!loading &&
          items.map((app) => {
            const current = app.state ?? 'submitted';
            const decidable = DECIDABLE.includes(current);
            const busy = busyId === app.id;
            return (
              <Card key={app.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold break-all">
                    {shortId(app.id)}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={STATE_BADGE[current] ?? ''}>
                      {current.replace('_', ' ')}
                    </Badge>
                    <span className="font-mono text-[11px]">
                      opportunity: {app.opportunityId ?? '—'}
                    </span>
                    <span className="text-[11px]">applied {formatWhen(app.createdAt)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {app.note && (
                    <p className="text-sm whitespace-pre-wrap rounded-md border border-border/60 bg-muted/20 p-3">
                      {app.note}
                    </p>
                  )}
                  {app.reviewReason && (
                    <p className="text-xs text-muted-foreground">
                      Previous decision reason: {app.reviewReason}
                    </p>
                  )}

                  {decidable ? (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Optional reason (max 500 characters, stored with the decision)"
                        maxLength={500}
                        value={reasons[app.id] ?? ''}
                        onChange={(e) => setReasons((prev) => ({ ...prev, [app.id]: e.target.value }))}
                        className="bg-neutral-950"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => decide(app.id, 'approved')}
                          disabled={busy}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => decide(app.id, 'rejected')} disabled={busy}>
                          <XCircle className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      Final state — no further decision is possible.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </AdminLayout>
  );
}
