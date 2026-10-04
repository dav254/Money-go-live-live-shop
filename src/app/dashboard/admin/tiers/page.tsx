'use client';

import * as React from 'react';
import { Gift, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TierBadge } from '@/components/trust/tier-badge';
import { BONUS_OPTIONS, tierMeta, type AccountTier, type TierProgress } from '@/lib/tiers';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * ADMIN · TIERS (`/dashboard/admin/tiers`).
 *
 * ## The one thing this screen must not be able to do
 *
 * There is no tier field in the grant form, and that is not an oversight waiting
 * to be "just added later". The whole value of an automatic badge is that it
 * cannot be handed out: the moment an admin can type `gold`, buyers are looking
 * at a favour instead of a record, and the badge stops meaning anything at all.
 *
 * So this screen reads tiers and offers acts. It shows the arithmetic, and it
 * lets an admin give a credit, a waiver or a promotion — recorded with who gave
 * it and why, visible to the person who received it.
 *
 * ## Why the tiers are recomputed here rather than stored and displayed
 *
 * The stored value is shown next to the earned one and any disagreement is
 * flagged. A badge that can only ever agree with itself is a badge nobody is
 * checking.
 */

interface BonusRecord {
  bonus?: string;
  bonusLabel?: string;
  amount?: number;
  reason?: string;
  grantedAt?: string;
  grantedBy?: string;
}

interface TierRow {
  uid: string;
  name: string;
  email: string;
  sold: number;
  bought: number;
  completed: number;
  storedTier: AccountTier;
  earnedTier: AccountTier;
  outOfDate: boolean;
  progress: TierProgress;
  bonusCount: number;
  bonuses: BonusRecord[];
}

interface TiersPayload {
  total: number;
  byTier: Record<string, number>;
  belowGold: number;
  outOfDate: number;
  rows: TierRow[];
}

export default function AdminTiersPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [data, setData] = React.useState<TiersPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [target, setTarget] = React.useState<TierRow | null>(null);
  const [bonusKey, setBonusKey] = React.useState<string>(BONUS_OPTIONS[0].key);
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/tiers', { headers: { authorization: `Bearer ${token}` } });
      if (res.status === 403) {
        setError('This account is not an admin.');
        return;
      }
      if (!res.ok) throw new Error('failed');
      setData((await res.json()) as TiersPayload);
      setError(null);
    } catch {
      setError('Could not load tiers.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const grant = async () => {
    if (!target) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    // Required, and not optional in the UI, because a bonus nobody can explain
    // is one the recipient cannot appeal or understand.
    if (!reason.trim()) {
      setFormError('Give a reason. The person will see this.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const token = await user!.getIdToken();
      const res = await fetch('/api/admin/tiers', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ uid: target.uid, bonus: bonusKey, amount: value, reason: reason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(json?.error || 'Could not record the bonus.');
        return;
      }
      setTarget(null);
      setAmount('');
      setReason('');
      toast({ title: 'Bonus recorded', description: 'It shows on the account, not on the badge.' });
      await load();
    } catch {
      setFormError('Could not record the bonus.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Tiers &amp; bonuses</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Tiers are computed from delivered transactions and cannot be set by hand. What
              you can do here is give a bonus on top — recorded with your name and your
              reason.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-3.5 w-3.5 animate-spin' : 'mr-2 h-3.5 w-3.5'} />
            Recompute
          </Button>
        </div>

        {error ? (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {error}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['gold', 'silver', 'bronze', 'none'] as AccountTier[]).map((t) => (
              <div key={t} className="rounded-lg border p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {tierMeta(t).label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{data?.byTier?.[t] ?? 0}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t === 'none' ? 'No completed transactions yet' : tierMeta(t).detail}
                </p>
              </div>
            ))}
          </div>
        )}

        {data && data.belowGold > 0 && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{data.belowGold}</span> account
            {data.belowGold === 1 ? ' is' : 's are'} below Gold. Gold arrives on the 20th
            completed transaction, on its own.
          </p>
        )}

        {data && data.outOfDate > 0 && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">{data.outOfDate}</span> stored badge
            {data.outOfDate === 1 ? '' : 's'} disagree{''}
            {data.outOfDate === 1 ? 's' : ''} with the delivered order count. Flagged in the
            table rather than silently corrected.
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tiers…
          </div>
        ) : data ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Bought</TableHead>
                  <TableHead>Next</TableHead>
                  <TableHead className="text-right">Bonuses</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.uid}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-xs text-muted-foreground">{row.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TierBadge tier={row.earnedTier} />
                        {row.outOfDate && (
                          <Badge variant="outline" className="text-[10px]">
                            stored: {row.storedTier}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.sold}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.bought}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.progress.next
                        ? `${row.progress.toNext} to ${tierMeta(row.progress.next).label}`
                        : 'Top tier'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.bonusCount}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={row.completed === 0}
                        title={
                          row.completed === 0
                            ? 'No completed transactions yet'
                            : 'Give a bonus on top of their tier'
                        }
                        onClick={() => {
                          setTarget(row);
                          setFormError(null);
                        }}
                      >
                        <Gift className="mr-1.5 h-3.5 w-3.5" />
                        Give
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Give {target?.name} a bonus</DialogTitle>
            <DialogDescription>
              On top of their {target ? tierMeta(target.earnedTier).label : ''} tier, which is
              earned from {target?.completed ?? 0} completed transactions. This does not change
              the tier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bonus-type">What are you giving</Label>
              <Select value={bonusKey} onValueChange={setBonusKey}>
                <SelectTrigger id="bonus-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BONUS_OPTIONS.map((b) => (
                    <SelectItem key={b.key} value={b.key}>
                      {b.label} — {b.detail}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bonus-amount">Amount</Label>
              <Input
                id="bonus-amount"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bonus-reason">Reason (they will read this)</Label>
              <Textarea
                id="bonus-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Why they are getting this."
              />
            </div>

            {formError && (
              <p className="text-xs text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={grant} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record bonus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}