'use client';

import * as React from 'react';

export function ProductLaunchMoment() {
  return (
    <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* copy */}
        <div className="lg:col-span-5">
          <span className="vn-phase text-primary">The launch moment</span>
          <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl">
            One product,{' '}
            <span className="vn-text-grad">announced once.</span>
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            When you list a product on Vidnov it does not live in only one corner
            of the internet. It appears in your storefront, in the feed that shows
            people near you and in the places you have connected. The same photo,
            the same price, the same availability — everywhere at once, and
            edited in one place.
          </p>

          <ul className="mt-8 space-y-2.5">
            {[
              'New product surfaces everywhere at the same time',
              'Same photo, same price, same availability',
              'Edit once, updates everywhere',
              'No copy-paste between stores',
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
              Launch your first product
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

        {/* visual — product reveal */}
        <div className="relative lg:col-span-7">
          <div className="vn-shadow relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
            <div className="relative">
              {/* stage */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-900/10 via-neutral-900/10 to-primary/10" />

              {/* product */}
              <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-cover bg-center shadow-2xl" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop)' }} />

              {/* floating stats */}
              <div className="absolute -right-2 top-6 z-10 max-w-[160px] rounded-xl border border-border bg-card/95 p-3 backdrop-blur shadow-lg">
                <div className="flex items-baseline gap-2">
                  <span className="font-grotesk text-2xl font-bold text-foreground">100.00</span>
                  <span className="text-xs text-muted-foreground">/ 87.00 yours</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/4 rounded-full bg-accent" />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">3% platform. You keep the rest.</p>
              </div>

              <div className="absolute left-4 top-6 z-10 rounded-xl border border-border bg-card/95 p-3 backdrop-blur shadow-lg">
                <p className="text-xs font-semibold text-foreground">Just listed</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Golden Step Footwear</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live everywhere
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
