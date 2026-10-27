'use client';

/**
 * SELLER APP · PAYMENTS.
 *
 * The other half of Earnings. Earnings answers "how much have I made"; this
 * answers "where does it go, and how do I get it".
 *
 * It is two things the seller never had inside the app:
 *
 *   1. The payout destinations the platform pays into — a bank account, a
 *      PayPal address, or a phone number (M-PESA) — stored at
 *      `userProfiles/{uid}/payoutMethods`, so the
 *      admin finance console reads them through the seller id and never has to
 *      guess which account to pay. Nothing else in the app writes here, which
 *      is what makes this screen the single source of truth for "where do I
 *      pay this seller".
 *
 *   2. Withdrawal requests, written to `payouts` exactly as the website's
 *      wallet writes them. The doc shape is the admin console's contract and is
 *      copied deliberately rather than redesigned — the moment these two drift,
 *      payouts stop showing up under /dashboard/admin/finance/seller-payouts.
 *
 * The balance here is the same ledger arithmetic the Earnings screen runs, so
 * the two can never disagree, minus what has already gone out. Withdrawal
 * requests are recorded against the ledger (`PAYOUT_REQUEST` /
 * `PAYOUT_COMPLETED`) by the cloud function, so nothing is subtracted twice.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  Check,
  Landmark,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { mirrorPayout } from '@/lib/wallet/mirror';
import { mirrorPayoutMethod } from '@/lib/users/mirror';
import { KENYA_BANKS } from '@/lib/constants';
import { PAYOUT_STATUS_LABEL } from '@/lib/types';
import type { Payout, PayoutMethod } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  EmptyState,
  SellerCard,
  SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

const CREDIT_TYPES = ['SALE_EARNING', 'SALE', 'COMMISSION', 'SHIPPING_FEE'];

interface LedgerEntry {
  id: string;
  type?: string;
  amount?: number;
}

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in (value as { toMillis?: unknown })) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}

const money = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Status pill for a withdrawal request. Mirrors Earnings' ledger colours. */
function PayoutStatusPill({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
      : status === 'failed'
        ? 'bg-red-500/12 text-red-600 dark:text-red-400'
        : status === 'processing'
          ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
          : 'bg-amber-500/12 text-amber-600 dark:text-amber-400';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
        tone,
      )}
    >
      {PAYOUT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add destination
// ---------------------------------------------------------------------------

type DestinationKind = 'bank' | 'paypal' | 'phone';

function AddDestinationSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [kind, setKind] = React.useState<DestinationKind>('bank');
  const [bankCode, setBankCode] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [accountNumber, setAccountNumber] = React.useState('');
  const [paypalEmail, setPaypalEmail] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setBankCode('');
    setAccountName('');
    setAccountNumber('');
    setPaypalEmail('');
    setPhoneNumber('');
    setError(null);
  };

  const close = () => {
    onOpenChange(false);
    // Clear after the sheet has animated out, so the fields do not visibly
    // blank while the panel is still sliding away.
    window.setTimeout(reset, 250);
  };

  const handleSave = async () => {
    if (!user || !firestore) return;
    setError(null);

    const trimmedNumber = accountNumber.replace(/\s+/g, '');
    // M-PESA numbers are normalised to international form before saving, so
    // the finance team never has to guess the prefix when paying out.
    const trimmedPhone = phoneNumber.replace(/[\s-]/g, '');
    if (kind === 'bank') {
      if (!bankCode) return setError('Choose the bank you hold this account with.');
      if (!accountName.trim()) return setError('Enter the name on the account.');
      if (trimmedNumber.length < 6) return setError('Enter a valid account number.');
    } else if (kind === 'phone') {
      if (!/^(?:\+?254|0)(7|1)\d{8}$/.test(trimmedPhone)) {
        return setError(
          'Enter a valid Kenyan phone number, e.g. 0712345678 or +254712345678.',
        );
      }
    } else if (!/^\S+@\S+\.\S+$/.test(paypalEmail.trim())) {
      return setError('Enter a valid PayPal email address.');
    }

    setIsSaving(true);
    try {
      const ref = collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
      const bank = KENYA_BANKS.find((b) => b.code === bankCode);
      // Captured so the VPS mirror can name the document that was created.
      let createdId: string | null = null;

      if (kind === 'bank') {
        // `details` is the one-line summary the admin console reads in the
        // payout row, so it is built here exactly as the website builds it:
        // only the last four digits of the account are ever surfaced.
        createdId = (await addDoc(ref, {
          type: 'bank',
          details: `${bank?.name ?? 'Bank'} - *...${trimmedNumber.slice(-4)}`,
          bankName: bank?.name ?? 'Unknown Bank',
          accountName: accountName.trim(),
          accountNumber: trimmedNumber,
          bankCode,
          country: 'Kenya',
        })).id;
      } else if (kind === 'phone') {
        const normalized = trimmedPhone.startsWith('+')
          ? trimmedPhone
          : trimmedPhone.startsWith('0')
            ? `+254${trimmedPhone.slice(1)}`
            : `+254${trimmedPhone}`;
        createdId = (await addDoc(ref, {
          type: 'phone',
          details: `M-PESA - ${normalized}`,
          phoneNumber: normalized,
          country: 'Kenya',
        })).id;
      } else {
        createdId = (await addDoc(ref, {
          type: 'paypal',
          details: paypalEmail.trim(),
          paypalEmail: paypalEmail.trim(),
        })).id;
      }

      if (createdId) mirrorPayoutMethod(user, createdId);
      toast({
        title: 'Saved',
        description: 'Your payment details are with the team now.',
      });
      onAdded();
      close();
    } catch (err) {
      console.error('Error saving payout method:', err);
      setError('Could not save those details. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto px-5 pb-6">
        <SheetHeader className="text-left">
          <SheetTitle className="font-grotesk text-lg">Where should we pay you?</SheetTitle>
          <SheetDescription className="text-xs">
            The team uses this to send your money. Keep it current — a wrong account
            delays every payout.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'bank' as const, label: 'Bank', icon: Landmark },
                { key: 'paypal' as const, label: 'PayPal', icon: Wallet },
                { key: 'phone' as const, label: 'Phone', icon: Smartphone },
              ] as const
            ).map((option) => {
              const active = kind === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setKind(option.key)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition',
                    active
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>

          {kind === 'bank' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pay-bank">Bank</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger id="pay-bank" className="h-11 bg-card">
                    <SelectValue placeholder="Choose your bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {KENYA_BANKS.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-account-name">Account name</Label>
                <Input
                  id="pay-account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="As it appears on your bank statement"
                  className="h-11 bg-card"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-account-number">Account number</Label>
                <Input
                  id="pay-account-number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  inputMode="numeric"
                  placeholder="1234567890"
                  className="h-11 bg-card font-grotesk tabular-nums"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : kind === 'phone' ? (
            <div className="space-y-2">
              <Label htmlFor="pay-phone">Phone number (M-PESA)</Label>
              <Input
                id="pay-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                inputMode="tel"
                placeholder="0712345678"
                className="h-11 bg-card font-grotesk tabular-nums"
                autoComplete="off"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Payouts are sent to this number via M-PESA. Use the number registered
                to your ID — the finance team sees it the moment you save it.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="pay-paypal">PayPal email</Label>
              <Input
                id="pay-paypal"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                inputMode="email"
                placeholder="you@example.com"
                className="h-11 bg-card"
                autoComplete="off"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Use the address the PayPal account is registered to, otherwise the
                transfer will bounce back.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            className="h-12 flex-1 rounded-xl"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-12 flex-1 rounded-xl"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save details
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Request a withdrawal
// ---------------------------------------------------------------------------

function WithdrawSheet({
  open,
  onOpenChange,
  methods,
  available,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  methods: PayoutMethod[];
  available: number;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [methodId, setMethodId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selected = methods.find((m) => m.id === methodId);

  React.useEffect(() => {
    if (open) {
      setMethodId(methods[0]?.id ?? '');
      setAmount('');
      setError(null);
    }
  }, [open, methods]);

  const parsed = Number(amount);
  const invalid =
    !selected ||
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    parsed > available;

  const handleSubmit = async () => {
    if (!user || !firestore || !selected || invalid) return;
    setError(null);
    setIsSaving(true);
    try {
      const payoutRef = await addDoc(collection(firestore, 'payouts'), {
        sellerId: user.uid,
        amount: parsed,
        payoutMethodId: selected.id,
        payoutMethodInfo: `${selected.type}: ${selected.details}`,
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      mirrorPayout(user, payoutRef.id);
      toast({
        title: 'Request sent',
        description: 'The team is reviewing it. You will see the status here.',
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error requesting payout:', err);
      setError('Could not send that request. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto px-5 pb-6">
        <SheetHeader className="text-left">
          <SheetTitle className="font-grotesk text-lg">Move money out</SheetTitle>
          <SheetDescription className="text-xs">
            The team pays out manually once a request is approved, straight to the
            destination you saved.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label>Send to</Label>
            <Select value={methodId} onValueChange={setMethodId}>
              <SelectTrigger className="h-11 bg-card">
                <SelectValue placeholder="Choose a destination" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.type === 'bank'
                      ? 'Bank'
                      : method.type === 'phone'
                        ? 'Phone'
                        : 'PayPal'} — {method.details}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="withdraw-amount">Amount</Label>
              <button
                type="button"
                onClick={() => setAmount(available.toFixed(2))}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
              >
                Use all {money(available)}
              </button>
            </div>
            <Input
              id="withdraw-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0.00"
              className="h-12 bg-card font-grotesk text-lg tabular-nums"
              autoComplete="off"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              You can move up to {money(available)} — everything you have earned and
              not yet withdrawn.
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-12 flex-1 rounded-xl"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || invalid}
            className="h-12 flex-1 rounded-xl"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export default function SellerSectionPayments() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isAdding, setIsAdding] = React.useState(false);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Payout destinations. A subcollection under the seller's own profile doc,
  // which `firestore.rules` grants the owner and nobody else.
  const methodsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'payoutMethods');
  }, [firestore, user]);
  const { data: methods, isLoading: isLoadingMethods } = useCollection<PayoutMethod>(methodsQuery);

  // Withdrawals, filtered on `sellerId` — the same filter `firestore.rules`
  // demands, so this never trips a bare list over `payouts`.
  const payoutsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'payouts'),
      where('sellerId', '==', user.uid),
      limit(50),
    );
  }, [firestore, user]);
  const { data: payouts, isLoading: isLoadingPayouts } = useCollection<Payout>(payoutsQuery);

  // The ledger, for the same balance Earnings shows. Read with the same
  // `userId == uid` filter.
  const ledgerQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'walletTransactions'),
      where('userId', '==', user.uid),
      limit(200),
    );
  }, [firestore, user]);
  const { data: ledger, isLoading: isLoadingLedger } = useCollection<LedgerEntry>(ledgerQuery);

  const earned = React.useMemo(
    () =>
      (ledger ?? []).reduce((sum, row) => {
        const amount = Number(row.amount ?? 0);
        return CREDIT_TYPES.includes(String(row.type)) && Number.isFinite(amount)
          ? sum + amount
          : sum;
      }, 0),
    [ledger],
  );

  const requests = React.useMemo(
    () =>
      (payouts ?? [])
        .slice()
        .sort((a, b) => millis(b.requestedAt) - millis(a.requestedAt)),
    [payouts],
  );

  const withdrawn = React.useMemo(
    () =>
      requests.reduce((sum, payout) => {
        const amount = Number(payout.amount ?? 0);
        if (!Number.isFinite(amount)) return sum;
        // Failed requests never left the balance, so they are not subtracted.
        return sum + (payout.status === 'failed' ? 0 : amount);
      }, 0),
    [requests],
  );

  const available = Math.max(earned - withdrawn, 0);
  const isLoading = isLoadingMethods || isLoadingPayouts || isLoadingLedger;

  const handleDelete = async (method: PayoutMethod) => {
    if (!user || !firestore) return;
    setDeletingId(method.id);
    try {
      await deleteDoc(doc(firestore, 'userProfiles', user.uid, 'payoutMethods', method.id));
      mirrorPayoutMethod(user, method.id, 'delete');
      toast({ title: 'Removed', description: 'That destination has been deleted.' });
    } catch (err) {
      console.error('Error deleting payout method:', err);
      toast({
        variant: 'destructive',
        title: 'Could not remove it',
        description: 'That destination is attached to a payout request.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <SellerSectionTitle eyebrow="Money" title="Payments" />

      {/* Available band. Same ember treatment as Earnings so the two read as
          one place — and the figure here is Earnings' figure minus what has
          already gone out. */}
      <section className="px-4">
        <div className="vn-seller-band vn-app-card overflow-hidden rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
              Ready to move
            </p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <p className="font-grotesk mt-2 text-4xl font-bold tabular-nums text-white">
            {isLoading ? '—' : money(available)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white/12 px-3 py-2.5 ring-1 ring-white/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
                Earned
              </p>
              <p className="font-grotesk mt-0.5 text-base font-bold tabular-nums text-white">
                {isLoading ? '—' : money(earned)}
              </p>
            </div>
            <div className="rounded-xl bg-white/12 px-3 py-2.5 ring-1 ring-white/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
                Moved out
              </p>
              <p className="font-grotesk mt-0.5 text-base font-bold tabular-nums text-white">
                {isLoading ? '—' : money(withdrawn)}
              </p>
            </div>
          </div>

          {/* Blue, not white. On the ember band a white button blended into the
              lightest corner, and against the band's navy base its own label
              had no contrast to sit on. A saturated blue is the one colour
              that separates from both ends of the gradient — it is the
              complementary of the ember, so it reads as an action, and white
              type on it clears contrast comfortably. Plain utilities, not the
              cva Button: its `bg-primary`/`text-primary-foreground` pair lives
              in the same Tailwind layer as these and can win the cascade. */}
          <button
            type="button"
            onClick={() => setIsWithdrawing(true)}
            disabled={!methods || methods.length === 0}
            className="mt-4 h-12 w-full rounded-xl bg-blue-700 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {methods && methods.length > 0 ? 'Move money out' : 'Add where to get paid'}
          </button>
        </div>
      </section>

      {/* Where you get paid. */}
      <section>
        <SellerSectionTitle
          eyebrow="Details"
          title="Where you get paid"
          action={
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-primary flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          }
        />

        {isLoadingMethods ? (
          <div className="space-y-2.5 px-4">
            {[0, 1].map((i) => (
              <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : !methods || methods.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No payment details yet"
            body="Add the bank account or PayPal address we should pay you into. The team sees it the moment you save it."
            action={
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                Add details
              </button>
            }
          />
        ) : (
          <ul className="space-y-2 px-4">
            {methods.map((method) => (
              <li
                key={method.id}
                className="vn-app-card flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  {method.type === 'phone' ? (
                    <Smartphone className="h-4 w-4" />
                  ) : method.type === 'bank' ? (
                    <Landmark className="h-4 w-4" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {method.type === 'bank'
                      ? 'Bank account'
                      : method.type === 'phone'
                        ? 'Phone (M-PESA)'
                        : 'PayPal'}
                  </p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {method.details}
                  </p>
                  {method.type === 'bank' && method.accountName && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {method.accountName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Remove this destination"
                  onClick={() => handleDelete(method)}
                  disabled={deletingId === method.id}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  {deletingId === method.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Withdrawal history. */}
      <section>
        <SellerSectionTitle eyebrow="History" title="Requests" />
        {isLoadingPayouts ? (
          <div className="space-y-2.5 px-4">
            {[0, 1].map((i) => (
              <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ArrowUpRight}
            title="Nothing requested yet"
            body="When you move money out, every request and where it got to stays on this screen."
          />
        ) : (
          <ul className="space-y-2 px-4">
            {requests.map((payout) => {
              const when = millis(payout.requestedAt);
              return (
                <li
                  key={payout.id}
                  className="vn-app-card rounded-2xl border border-border/80 bg-card p-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-grotesk text-base font-bold tabular-nums text-foreground">
                      {money(Number(payout.amount ?? 0))}
                    </p>
                    <PayoutStatusPill status={payout.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {payout.payoutMethodInfo}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Asked for
                    {when ? ` ${new Date(when).toLocaleDateString()}` : ''}
                    {payout.transactionId ? ` · Ref ${payout.transactionId}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="px-4">
        <SellerCard className="vn-app-card bg-secondary/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            How payouts work
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Requests are reviewed by the team, usually within one business day. You keep
            the status above up to date — nothing is paid out to a destination you have
            not confirmed, and a failed request stays in your balance.
          </p>
          <Link
            href="/app/seller/earnings"
            className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
          >
            Back to earnings
          </Link>
        </SellerCard>
      </div>

      <AddDestinationSheet
        open={isAdding}
        onOpenChange={setIsAdding}
        onAdded={() => undefined}
      />
      <WithdrawSheet
        open={isWithdrawing}
        onOpenChange={setIsWithdrawing}
        methods={methods ?? []}
        available={available}
      />
    </div>
  );
}