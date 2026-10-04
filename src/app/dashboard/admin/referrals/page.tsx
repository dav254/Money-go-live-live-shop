'use client';

/**
 * ADMIN · REFERRALS & REWARDS (`/dashboard/admin/referrals`).
 *
 * ## What this replaces
 *
 * A referrals table already existed at `/dashboard/admin/users/referrals`. It
 * listed every signup as its own row with no rollup, so answering the only
 * question that matters — "who brought how many users?" — meant counting rows
 * by hand, and there was no way to act on anything you saw. This screen is the
 * operable version of that idea: one row per referrer, ranked, with the
 * approvals and rewards attached.
 *
 * The old route is kept and now links here.
 *
 * ## Where the numbers come from
 *
 * `referrals` documents are the single source of truth. The leaderboard is
 * aggregated in memory from them, never stored, so a rollup can never drift
 * out of step with the underlying signups. Points follow the escalating tiers
 * in `lib/referrals/rewards.ts` — the same function the buyer and seller
 * screens use, so the amount shown here is exactly the amount they were paid.
 *
 * ## Approving is the only thing that pays
 *
 * A signup is created `pending` by the invitee. It earns nothing until an
 * admin approves it. That is deliberate: it means point-farming (self-referral
 * via a second account, bulk fake signups) has to be waved through by a human
 * before it costs anything, and "flagged" is a real state an admin can leave a
 * signup in while they investigate rather than having to reject it outright.
 *
 * `referrals.update` is admin-only in the rules, so a referrer cannot flip
 * their own row back to approved and re-claim the points — the client-side
 * guard here is only a second line of defence.
 *
 * ## Reading userProfiles
 *
 * This screen is admin, and `userProfiles.list` is admin-gated, so the
 * referrer profiles come from a single filtered list rather than the per-id
 * `getDoc` loop the app screens must use. It is still bounded by
 * `MAX_REFERRER_FETCH` so a large deployment cannot pull the whole collection
 * into a browser tab.
 */

import * as React from 'react';
import {
  BadgeCheck, CheckCircle2, Download, Flag, Loader2, Search, ShieldAlert,
  Sparkles, TrendingUp, UserPlus, XCircle,
} from 'lucide-react';

import {
  collection, doc, getDocs, increment, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Referral, ReferralLeaderboardRow, UserProfile } from '@/lib/types';
import {
  DELIVERY_CREDITS_PER_SIGNUP, formatPoints, pointsForSignup,
} from '@/lib/referrals/rewards';
import { referralCodeFor } from '@/lib/referrals/referral-code';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** Upper bound on referrer profiles pulled into the tab in one go. */
const MAX_REFERRER_FETCH = 200;

type StatusFilter = 'all' | 'pending' | 'approved' | 'flagged' | 'rejected';

const STATUS_TONE: Record<Referral['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300',
  approved: 'bg-emerald-500/15 text-emerald-300',
  flagged: 'bg-orange-500/15 text-orange-300',
  rejected: 'bg-red-500/15 text-red-400',
};

export default function AdminReferralsRewardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [referrals, setReferrals] = React.useState<Referral[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [search, setSearch] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // The grant dialog's target.
  const [grantTarget, setGrantTarget] = React.useState<ReferralLeaderboardRow | null>(null);
  const [grantPoints, setGrantPoints] = React.useState('100');
  const [grantCredits, setGrantCredits] = React.useState('0');
  const [grantReason, setGrantReason] = React.useState('');

  /* ------------------------------------------------------------- read side */

  React.useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, 'referrals'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setReferrals(
          snap.docs.map((d) => ({ ...(d.data() as Referral), id: d.id }) as Referral),
        );
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
  }, [firestore]);

  // Referrer profiles. Admin-only list, bounded.
  const referrerIds = React.useMemo(() => {
    const ids = new Set<string>();
    referrals.forEach((r) => {
      if (r.referrerId) ids.add(r.referrerId);
    });
    return Array.from(ids).slice(0, MAX_REFERRER_FETCH);
  }, [referrals]);

  React.useEffect(() => {
    if (!firestore || referrerIds.length === 0) return;
    let alive = true;

    (async () => {
      const out: Record<string, UserProfile> = {};
      // `in` caps at 30 values.
      for (let i = 0; i < referrerIds.length; i += 30) {
        const chunk = referrerIds.slice(i, i + 30);
        const snap = await getDocs(
          query(collection(firestore, 'userProfiles'), where('__name__', 'in', chunk)),
        ).catch(() => null);
        snap?.forEach((d) => {
          out[d.id] = d.data() as UserProfile;
        });
      }
      if (alive) setProfiles((p) => ({ ...p, ...out }));
    })();

    return () => {
      alive = false;
    };
  }, [firestore, referrerIds]);

  /* ---------------------------------------------------------- aggregation */

  const leaderboard = React.useMemo<ReferralLeaderboardRow[]>(() => {
    const rows = new Map<string, ReferralLeaderboardRow>();

    referrals.forEach((r) => {
      const id = r.referrerId;
      if (!id) return;
      if (!rows.has(id)) {
        rows.set(id, {
          referrerId: id,
          referrerName: '',
          role: '',
          approved: 0,
          pending: 0,
          flagged: 0,
          rejected: 0,
          totalPoints: 0,
          deliveryCredits: 0,
          lastSignupAt: 0,
        });
      }
      const row = rows.get(id)!;
      row[r.status] += 1;
      if (r.status === 'approved') {
        row.totalPoints += Number(r.pointsAwarded) || 0;
        row.deliveryCredits += DELIVERY_CREDITS_PER_SIGNUP;
      }
      const ts = (r.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      if (ts > row.lastSignupAt) row.lastSignupAt = ts;
    });

    // Fill identity from the fetched profiles where available.
    rows.forEach((row) => {
      const p = profiles[row.referrerId];
      row.referrerName = p?.fullName || p?.displayName || `User ${row.referrerId.slice(0, 8)}`;
      row.referrerEmail = p?.email;
      row.role = p?.role || p?.userRole || '—';
    });

    return Array.from(rows.values()).sort(
      (a, b) => b.approved - a.approved || b.totalPoints - a.totalPoints,
    );
  }, [referrals, profiles]);

  const filteredReferrals = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return referrals.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!term) return true;
      return (
        (r.refereeName || '').toLowerCase().includes(term) ||
        (r.refereeEmail || '').toLowerCase().includes(term) ||
        (r.code || '').toLowerCase().includes(term)
      );
    });
  }, [referrals, statusFilter, search]);

  const totals = React.useMemo(
    () => ({
      signups: referrals.length,
      approved: referrals.filter((r) => r.status === 'approved').length,
      pending: referrals.filter((r) => r.status === 'pending').length,
      flagged: referrals.filter((r) => r.status === 'flagged').length,
      points: leaderboard.reduce((s, r) => s + r.totalPoints, 0),
    }),
    [referrals, leaderboard],
  );

  /* ------------------------------------------------------------ write side */

  /**
   * Approving credits the referrer. The points are recomputed here from the
   * referrer's CURRENT approved count rather than trusted from the row, so a
   * stale `pointsAwarded` can never be used to inflate a payout.
   */
  const setStatus = async (
    referral: Referral,
    status: Referral['status'],
    note?: string,
  ) => {
    if (!firestore || !user) return;
    setBusyId(referral.id);

    try {
      const wasApproved = referral.status === 'approved';
      const willApprove = status === 'approved';

      const update: Record<string, unknown> = {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
        ...(note ? { note } : {}),
      };

      // Points depend on how many the referrer had banked BEFORE this signup.
      //
      // Computed ONCE and reused for both the document and the balance. An
      // earlier version wrote the correct tier to the row but then paid
      // `Number(referral.pointsAwarded) || pointsForSignup(0)` into the
      // balance — and since a fresh signup has no `pointsAwarded` yet, that
      // fallback paid the STARTER rate (50) no matter which band the referrer
      // was actually in. Approving signup #31 would have paid 50 instead of
      // 150, and the two numbers would disagree permanently.
      let payoutPoints = 0;
      if (willApprove && !wasApproved) {
        const alreadyApproved = referrals.filter(
          (r) => r.referrerId === referral.referrerId && r.status === 'approved',
        ).length;
        payoutPoints = pointsForSignup(alreadyApproved);
        update.pointsAwarded = payoutPoints;
      }

      await updateDoc(doc(firestore, 'referrals', referral.id), update);

      // Credit or claw back the referrer's balances to match the new status.
      // Approving pays out; un-approving takes it back, so flipping a decision
      // never leaves the referrer holding points for a signup that was undone.
      const deltaPoints = willApprove && !wasApproved ? payoutPoints : 0;
      const clawbackPoints = wasApproved && !willApprove ? Number(referral.pointsAwarded) || 0 : 0;
      const creditDelta = willApprove && !wasApproved ? DELIVERY_CREDITS_PER_SIGNUP : 0;
      const clawbackCredits = wasApproved && !willApprove ? DELIVERY_CREDITS_PER_SIGNUP : 0;

      if (deltaPoints || clawbackPoints || creditDelta || clawbackCredits) {
        await updateDoc(doc(firestore, 'userProfiles', referral.referrerId), {
          referralPoints: increment(deltaPoints - clawbackPoints),
          deliveryCredits: increment(creditDelta - clawbackCredits),
          referralCount: increment(willApprove && !wasApproved ? 1 : wasApproved && !willApprove ? -1 : 0),
        });
      }

      toast({ title: `Referral ${status}` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update that referral.' });
    } finally {
      setBusyId(null);
    }
  };

  const grantRewards = async () => {
    if (!firestore || !user || !grantTarget) return;
    const points = Math.max(0, Math.floor(Number(grantPoints) || 0));
    const credits = Math.max(0, Math.floor(Number(grantCredits) || 0));
    if (points === 0 && credits === 0) {
      toast({ variant: 'destructive', title: 'Enter points or credits to grant.' });
      return;
    }

    setBusyId(grantTarget.referrerId);
    try {
      // A write batch so the grant and its audit record land together — a grant
      // with no record of why is the thing that makes rewards unauditable.
      const grantRef = doc(collection(firestore, 'referralGrants'));
      const batch = writeBatch(firestore);

      const data: Record<string, unknown> = {};
      if (points) data.referralPoints = increment(points);
      if (credits) data.deliveryCredits = increment(credits);
      batch.update(doc(firestore, 'userProfiles', grantTarget.referrerId), data);
      batch.set(grantRef, {
        userId: grantTarget.referrerId,
        points,
        deliveryCredits: credits,
        reason: grantReason.trim() || 'Admin reward',
        grantedBy: user.uid,
        grantedAt: serverTimestamp(),
      });
      await batch.commit();

      toast({
        title: 'Reward granted',
        description: `${formatPoints(points)} points and ${credits} delivery credits to ${grantTarget.referrerName}.`,
      });
      setGrantTarget(null);
      setGrantPoints('100');
      setGrantCredits('0');
      setGrantReason('');
    } catch {
      toast({ variant: 'destructive', title: 'Could not grant that reward.' });
    } finally {
      setBusyId(null);
    }
  };

  /* ------------------------------------------------------------- CSV export */

  /**
   * Exports the leaderboard as CSV.
   *
   * Built as a Blob and downloaded via an object URL rather than sent to a
   * server: the data is already in the browser, and a server round-trip would
   * mean exporting other people's referral data through an endpoint that could
   * be logged. Values are quoted and embedded quotes doubled, so a name
   * containing a comma cannot break the column alignment.
   */
  const exportCsv = () => {
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Referrer', 'Email', 'Role', 'Code', 'Approved', 'Pending', 'Flagged',
      'Rejected', 'Total referrals', 'Points earned', 'Delivery credits',
      'Balance (points)', 'Last signup',
    ];

    const rows = leaderboard.map((r) => {
      const p = profiles[r.referrerId];
      return [
        r.referrerName,
        r.referrerEmail || '',
        r.role,
        referralCodeFor(r.referrerId),
        r.approved,
        r.pending,
        r.flagged,
        r.rejected,
        r.approved + r.pending + r.flagged + r.rejected,
        r.totalPoints,
        r.deliveryCredits,
        p?.referralPoints ?? 0,
        r.lastSignupAt ? new Date(r.lastSignupAt).toISOString().slice(0, 10) : '',
      ].map(escape).join(',');
    });

    const csv = [header.map(escape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vidnov-referrals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${leaderboard.length} referrers written to CSV.` });
  };

  /* ----------------------------------------------------------------- render */

  const stat = (label: string, value: React.ReactNode, icon: React.ElementType) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    );
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Referrals &amp; Rewards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who brought how many users, what it cost, and what to do about it.
            A signup earns nothing until it is approved below.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={leaderboard.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stat('Signups', totals.signups, UserPlus)}
        {stat('Approved', totals.approved, BadgeCheck)}
        {stat('Pending', totals.pending, Loader2)}
        {stat('Flagged', totals.flagged, ShieldAlert)}
        {stat('Points paid', formatPoints(totals.points), Sparkles)}
      </div>

      {/* ------------------------------------------------------ leaderboard */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <TrendingUp className="h-4 w-4" />
          Leaderboard
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No referrals yet. They appear the moment a user signs up with a code.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Referrer</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 text-right">Approved</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Flagged</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Reward</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, i) => {
                  const p = profiles[row.referrerId];
                  return (
                    <tr key={row.referrerId} className="border-t">
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.referrerName}</p>
                        {row.referrerEmail && (
                          <p className="text-xs text-muted-foreground">{row.referrerEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{row.role}</td>
                      <td className="px-4 py-3 font-mono text-xs">{referralCodeFor(row.referrerId)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{row.approved}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-300">{row.pending}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-300">{row.flagged}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPoints(row.totalPoints)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatPoints(p?.referralPoints ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setGrantTarget(row)}
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          Grant
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ the queue */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Referral queue</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or code"
              className="h-10 w-64 rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'pending', 'approved', 'flagged', 'rejected'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium capitalize transition',
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {filteredReferrals.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nothing matches this filter.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Invitee</th>
                  <th className="px-4 py-3">Referrer</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReferrals.map((r) => {
                  const busy = busyId === r.id;
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.refereeName || '—'}</p>
                        {r.refereeEmail && (
                          <p className="text-xs text-muted-foreground">{r.refereeEmail}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {profiles[r.referrerId]?.fullName || r.referrerId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded-full px-2 py-1 text-xs font-medium capitalize', STATUS_TONE[r.status])}>
                          {r.status}
                        </span>
                        {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.pointsAwarded ? formatPoints(r.pointsAwarded) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              {r.status !== 'approved' && (
                                <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'approved')}>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                                  Approve
                                </Button>
                              )}
                              {r.status !== 'flagged' && (
                                <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'flagged', 'Flagged for review')}>
                                  <Flag className="mr-1 h-3.5 w-3.5 text-orange-400" />
                                  Flag
                                </Button>
                              )}
                              {r.status !== 'rejected' && (
                                <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'rejected', 'Rejected by admin')}>
                                  <XCircle className="mr-1 h-3.5 w-3.5 text-red-400" />
                                  Reject
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ grant dialog */}
      <Dialog open={!!grantTarget} onOpenChange={(o) => !o && setGrantTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant a reward</DialogTitle>
            <DialogDescription>
              {grantTarget
                ? `${grantTarget.referrerName} currently has ${grantTarget.approved} approved referrals.`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Points</span>
              <input
                type="number"
                min={0}
                value={grantPoints}
                onChange={(e) => setGrantPoints(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Free delivery credits
              </span>
              <input
                type="number"
                min={0}
                value={grantCredits}
                onChange={(e) => setGrantCredits(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Reason</span>
              <input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Top recruiter, March"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Recorded against the user so every reward has a reason attached.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>
              Cancel
            </Button>
            <Button onClick={grantRewards} disabled={busyId === grantTarget?.referrerId}>
              {busyId === grantTarget?.referrerId && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Grant reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
