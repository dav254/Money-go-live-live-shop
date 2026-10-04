'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft, ChevronRight, CreditCard, Package, RotateCcw, Wallet,
} from 'lucide-react';
import { collection, limit, query, where } from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  BuyerEmptyState, BuyerSectionTitle,
} from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · WALLET.
 *
 * ## Why this is "Refunds", not a payout manager
 *
 * The website's `/buyer/wallet` is a 368-line payout-method screen: bank and
 * PayPal details for cashing *out*. That is a seller instrument. A buyer has no
 * balance to cash out — what they actually hold is credit an admin issued them
 * when an order was refunded.
 *
 * The data behind that already exists. `POST /api/admin/orders/[orderId]/refund`
 * writes a `walletTransactions` document with `userId: buyerId`, `type: 'REFUND'`
 * and a **positive** amount for the buyer (and negative reversals for the
 * seller, the reseller and the platform). So this screen reads exactly those
 * documents and shows real money movement instead of an empty payout form.
 *
 * ## Scope
 *
 * Two reads, both equality-filtered on the signed-in uid, because that is all
 * the Firestore rules permit on these collections — never a bare `list()`.
 * Neither `orderBy`s: an equality filter plus a range on a different field
 * would demand a composite index this project has not provisioned, so both are
 * sorted in memory instead.
 */

interface BuyerLedgerEntry {
  id: string;
  type?: string;
  amount?: number;
  description?: string;
  orderId?: string;
  timestamp?: unknown;
}

function money(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });
}

function toMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in (value as { toMillis?: unknown })) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}

function relativeTime(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function BuyerSectionWallet() {
  const { user } = useUser();
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'orders'), where('buyerId', '==', user.uid), limit(200));
  }, [firestore, user]);

  const ledgerQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'walletTransactions'),
      where('userId', '==', user.uid),
      limit(200),
    );
  }, [firestore, user]);

  const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);
  const { data: ledger, isLoading: ledgerLoading } = useCollection<BuyerLedgerEntry>(ledgerQuery);

  const entries = React.useMemo(
    () => (ledger ?? []).slice().sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp)),
    [ledger],
  );

  const { credit, refunds } = React.useMemo(() => {
    let credit = 0;
    let refunds = 0;
    for (const entry of entries) {
      const amount = Number(entry.amount ?? 0);
      if (amount > 0) credit += amount;
      if (entry.type === 'REFUND') refunds += 1;
    }
    return { credit, refunds };
  }, [entries]);

  const spend = React.useMemo(
    () =>
      (orders ?? [])
        .filter((o) => o.orderStatus !== 'cancelled' && o.orderStatus !== 'refunded')
        .reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0),
    [orders],
  );

  const refundedOrders = React.useMemo(
    () => (orders ?? []).filter((o) => o.orderStatus === 'refunded').length,
    [orders],
  );

  const isLoading = ordersLoading || ledgerLoading;

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle eyebrow="Money" title="Refunds & payments" />

      {/* Credit balance. A buyer holds no spendable balance — only refund
          credit — so this is labelled as credit rather than as a wallet. */}
      <section className="px-4">
        <div className="vn-buyer-band relative overflow-hidden rounded-3xl p-5 shadow-lg">
          <div
            aria-hidden
            className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/15 blur-2xl"
          />
          <div className="relative">
            <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-white/85">
              Refund credit
            </p>
            <p className="mt-2 font-sans text-4xl font-semibold tabular-nums text-white">
              {isLoading ? '—' : money(credit)}
            </p>
            <p className="mt-2 font-sans text-xs leading-relaxed text-white/75">
              Issued when an admin refunds one of your orders. Talk to support to
              have it returned to your original payment method.
            </p>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="grid grid-cols-3 gap-2.5 px-4">
        {[
          { label: 'Spent', value: isLoading ? '—' : money(spend) },
          { label: 'Refunds', value: isLoading ? '—' : String(refunds) },
          { label: 'Orders', value: isLoading ? '—' : String(orders?.length ?? 0) },
        ].map((stat) => (
          <div key={stat.label} className="vn-buyer-card px-3 py-3 text-center">
            <p className="truncate text-base font-semibold tabular-nums text-foreground">
              {stat.value}
            </p>
            <p className="vn-micro mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* Ledger */}
      <section>
        <h2 className="vn-micro px-4 pb-2 text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Refund history
        </h2>

        {ledgerLoading ? (
          <div className="space-y-2.5 px-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="vn-skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <BuyerEmptyState
            icon={Wallet}
            title="No refunds yet"
            body="Every refund an admin issues on your behalf lands here as a line in your ledger."
            action={
              <Link
                href="/app/buyer/orders"
                className="vn-buyer-card px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
              >
                See my orders
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2 px-4">
            {entries.map((entry) => {
              const amount = Number(entry.amount ?? 0);
              const positive = amount > 0;
              const target = entry.orderId ? `/app/buyer/orders` : null;
              const body = (
                <div className="vn-buyer-card flex w-full items-center gap-3 p-3.5 text-left transition">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
                      positive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/15 text-red-500',
                    )}
                  >
                    {positive ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {entry.description || (entry.type === 'REFUND' ? 'Refund' : 'Adjustment')}
                    </span>
                    <span className="vn-micro mt-0.5 block text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {relativeTime(entry.timestamp)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-sans text-sm font-semibold tabular-nums',
                      positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500',
                    )}
                  >
                    {positive ? '+' : ''}
                    {money(amount)}
                  </span>
                  {target && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </div>
              );

              return (
                <li key={entry.id}>{target ? <Link href={target}>{body}</Link> : body}</li>
              );
            })}
          </ul>
        )}
      </section>

      {/* What the credit is for, and where to take it up. */}
      <section className="space-y-2 px-4">
        <Link
          href="/app/buyer/orders"
          className="vn-buyer-card flex items-center gap-3 p-3.5 transition hover:scale-[1.01]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/25 text-cyan-600 dark:text-cyan-300">
            <Package className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">My orders</span>
            <span className="block font-sans text-[11px] text-muted-foreground">
              {refundedOrders > 0
                ? `${refundedOrders} refunded · tap to review`
                : 'Track, dispute and review'}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        <Link
          href="/app/buyer/care"
          className="vn-buyer-card flex items-center gap-3 p-3.5 transition hover:scale-[1.01]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/25 text-cyan-600 dark:text-cyan-300">
            <CreditCard className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Payment help</span>
            <span className="block font-sans text-[11px] text-muted-foreground">
              Refunds, charges and payment methods
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}