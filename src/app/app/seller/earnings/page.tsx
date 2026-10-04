'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownLeft, CreditCard, Wallet } from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import {
  EmptyState, SellerCard, SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/**
 * SELLER APP · EARNINGS.
 *
 * Clone of the website's earnings/wallet view, scoped to this seller. The
 * query is filtered on `userId == uid`, which is what `firestore.rules`
 * requires — a bare list over `walletTransactions` is rejected.
 *
 * Amounts are derived from the ledger itself rather than a second total, so
 * the figure on screen always matches the transactions beneath it.
 */

interface LedgerEntry {
  id: string;
  type?: string;
  amount?: number;
  description?: string;
  timestamp?: unknown;
  date?: unknown;
}

const CREDIT_TYPES = ['SALE_EARNING', 'SALE', 'COMMISSION', 'SHIPPING_FEE'];

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in (value as { toMillis?: unknown })) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}

export default function SellerSectionEarnings() {
  const { user } = useUser();
  const firestore = useFirestore();

  const ledgerQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'walletTransactions'),
      where('userId', '==', user.uid),
      limit(50),
    );
  }, [firestore, user]);

  const { data: entries, isLoading } = useCollection<LedgerEntry>(ledgerQuery);

  const rows = React.useMemo(
    () =>
      (entries ?? [])
        .slice()
        .sort((a, b) => millis(b.timestamp ?? b.date) - millis(a.timestamp ?? a.date)),
    [entries],
  );

  const balance = React.useMemo(
    () =>
      rows.reduce((sum, row) => {
        const amount = Number(row.amount ?? 0);
        if (!Number.isFinite(amount)) return sum;
        return sum + (CREDIT_TYPES.includes(String(row.type)) ? amount : -amount);
      }, 0),
    [rows],
  );

  const credits = React.useMemo(
    () =>
      rows.reduce((sum, row) => {
        const amount = Number(row.amount ?? 0);
        return CREDIT_TYPES.includes(String(row.type)) && Number.isFinite(amount)
          ? sum + amount
          : sum;
      }, 0),
    [rows],
  );

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <SellerSectionTitle eyebrow="Money" title="Earnings" />

      {/* Balance band — the ember treatment again, so money reads as part of
          this section and not as a widget lifted from the website. */}
      <section className="px-4">
        <div className="vn-seller-band vn-app-card overflow-hidden rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/70">
              Wallet balance
            </p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="font-grotesk mt-2 text-4xl font-bold tabular-nums text-white">
            {isLoading ? '—' : `$${balance.toFixed(2)}`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white/12 px-3 py-2.5 ring-1 ring-white/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
                Credited
              </p>
              <p className="font-grotesk mt-0.5 text-base font-bold tabular-nums text-white">
                {isLoading ? '—' : `$${credits.toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-xl bg-white/12 px-3 py-2.5 ring-1 ring-white/20">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70">
                Entries
              </p>
              <p className="font-grotesk mt-0.5 text-base font-bold tabular-nums text-white">
                {isLoading ? '—' : rows.length}
              </p>
            </div>
          </div>

          {/* The way out of this screen. Earnings answers "how much", Payments
              answers "where does it go" — and the seller reaches this page the
              moment a sale lands, so the exit belongs here rather than only in
              a menu they have to already know about. */}
          <Link
            href="/app/seller/payments"
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition hover:bg-blue-600"
          >
            <CreditCard className="h-4 w-4" />
            Where you get paid
          </Link>
        </div>
      </section>

      <div className="px-4">
        <SellerCard className="vn-app-card bg-secondary/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            How the split works
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Every delivered order is split automatically: 10% platform fee, 16% VAT, 10% reseller
            commission when one was involved, and 1% to the seller who referred you. What remains
            is credited to your wallet with a ledger entry you can see below.
          </p>
        </SellerCard>
      </div>

      {/* Ledger */}
      <section>
        <SellerSectionTitle eyebrow="Ledger" title="Recent activity" />
        {isLoading ? (
          <div className="space-y-2.5 px-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="vn-skeleton h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions yet"
            body="Your first credited sale will appear here with a full breakdown of the split."
            action={
              <Link
                href="/app/seller/products"
                className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                View stock
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2 px-4">
            {rows.map((row) => {
              const raw = Number(row.amount ?? 0);
              const amount = Number.isFinite(raw) ? raw : 0;
              const credit = CREDIT_TYPES.includes(String(row.type));
              const when = millis(row.timestamp ?? row.date);
              return (
                <li
                  key={row.id}
                  className="vn-app-card flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      credit
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    <ArrowDownLeft
                      className={cn('h-4 w-4', credit && 'rotate-180')}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {row.description || String(row.type ?? 'Transaction')}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      {String(row.type ?? 'entry')}
                      {when ? ` · ${new Date(when).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-grotesk shrink-0 text-sm font-bold tabular-nums',
                      credit ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
                    )}
                  >
                    {credit ? '+' : '−'}${Math.abs(amount).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
