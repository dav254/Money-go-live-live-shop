'use client';

import * as React from 'react';

export function OrderOnTheTable() {
  return (
    <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* copy */}
        <div className="lg:col-span-5">
          <span className="vn-phase text-primary">The payout moment</span>
          <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl">
            Money that{' '}
            <span className="vn-text-grad">actually arrives.</span>
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            The buyer pays, the money is held, the order is delivered, the
            confirmation lands and the payout is split exactly as promised —
            seller, reseller, referrer and Vidnov. No surprises, no manual
            transfer, no waiting on a person to move the money.
          </p>

          <ul className="mt-8 space-y-2.5">
            {[
              'Funds held until delivery is confirmed',
              'Automatic split on every completed order',
              'Itemised on your statement, not hidden',
              'No flat fees while you are building',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-foreground/85">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:shadow"
            >
              Open a seller account
              <svg
                className="h-4 w-4 text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* visual — order on the table */}
        <div className="relative lg:col-span-7">
          <div className="vn-shadow relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="relative">
              {/* table surface */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-neutral-800/8 via-transparent to-amber-900/8" />

              {/* table texture */}
              <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 12px, hsl(var(--border) / 0.25) 12px 13px)' }} />

              {/* coffee ring */}
              <div className="absolute right-6 top-6 h-16 w-16 rounded-full border border-white/10 bg-white/5 blur-sm" />

              {/* order ticket */}
              <div className="absolute left-6 top-8 z-10 max-w-[220px] rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  Order #8842
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">Golden Step Footwear</span>
                    <span className="font-mono text-foreground">100.00</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted">
                    <div className="h-full w-3/4 rounded-full bg-accent/60" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Delivered · payout split
                </div>
              </div>

              {/* phone */}
              <div className="absolute right-4 bottom-6 z-10">
                <div className="flex aspect-[9/17] items-center justify-center rounded-2xl border-2 border-border bg-black/80 shadow-xl sm:aspect-[9/16]">
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">Vidnov</span>
                  </div>
                  <div className="mt-2 h-2 w-3/4 rounded-full bg-white/20" />
                  <div className="mt-1 h-2 w-1/2 rounded-full bg-white/15" />
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="aspect-square rounded-md bg-white/15" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
