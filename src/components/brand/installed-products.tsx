'use client';

import * as React from 'react';

/**
 * Installed product panel — npm, Shopify, WooCommerce and Etsy cards as a
 * hand-drawn visual. Kept as a single file so the homepage edit does not need
 * to touch any existing component tree beyond the import already in page.tsx.
 */

const SHOPOGRAPHY = [
  {
    name: 'npm',
    count: '2 packages',
    accent: 'from-violet-500 to-violet-400',
    diff: '1 published today',
    logo: (
      <svg viewBox="0 0 100 100" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="14" y="14" width="72" height="72" rx="16" fill="currentColor" />
        <path
          d="M31 40h38M31 50h38M31 60h22"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    name: 'Shopify',
    count: '1 storefront live',
    accent: 'from-cyan-500 to-cyan-300',
    diff: 'New theme applied',
    logo: (
      <svg viewBox="0 0 100 100" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="14" y="10" width="72" height="80" rx="14" fill="currentColor" />
        <path
          d="M36 46h28M36 58h18"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="64" cy="70" r="6" fill="white" />
      </svg>
    ),
  },
  {
    name: 'WooCommerce',
    count: 'Store 2 of 3',
    accent: 'from-amber-500 to-orange-400',
    diff: 'Catalog synced',
    logo: (
      <svg viewBox="0 0 100 100" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="14" y="16" width="72" height="68" rx="16" fill="currentColor" />
        <path
          d="M36 42h28M36 54h18l8 8-8 8H36"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: 'Etsy',
    count: 'Shop 4 of 4',
    accent: 'from-rose-500 to-pink-400',
    diff: 'Open for orders',
    logo: (
      <svg viewBox="0 0 100 100" fill="none" className="h-6 w-6" aria-hidden="true">
        <rect x="14" y="16" width="72" height="68" rx="16" fill="currentColor" />
        <path
          d="M36 40h28M36 52h18l8 8-8 8H36"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function InstalledProducts() {
  return (
    <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* copy */}
        <div className="lg:col-span-5">
          <span className="vn-phase text-primary">One catalogue</span>
          <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl">
            Your shop,{' '}
            <span className="vn-text-grad">every surface.</span>
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            Publish once to Vidnov and the same catalogue and prices appear on the
            pages you already live on. If a price changes on one, it changes
            everywhere at the same time — no manual sync, no stale listing that
            makes a customer trust the wrong number.
          </p>

          <ul className="mt-8 space-y-2.5">
            {[
              'Same catalogue, same prices, same availability',
              'New product surfaces the moment you add it',
              'No copy-paste between storefronts',
              'One place to edit, the rest follow',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-foreground/85">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
              See all connected stores
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

        {/* visual — phone among shelves */}
        <div className="relative lg:col-span-7">
          <div className="vn-shadow relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
            {/* shelves */}
            <div className="relative">
              {/* back wall */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/10 via-transparent to-primary/10" />

              {/* shelf 1 */}
              <div className="relative z-10 flex items-end gap-2 pb-0 sm:pb-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 w-20 shrink-0 rounded-xl bg-cover bg-center bg-no-repeat opacity-90 sm:h-36 sm:w-24"
                    style={{
                      backgroundImage:
                        'url(https://images.unsplash.com/photo-1549298916-b41d501d3772?w=120&h=160&fit=crop)',
                      transform: `rotate(${(i - 1.5) * 1.5}deg)`,
                    }}
                  />
                ))}
                <div className="ml-auto flex h-28 w-20 shrink-0 items-end rounded-xl bg-cover bg-center bg-no-repeat opacity-90 sm:h-36 sm:w-24" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542211705-64120d1d2c5a?w=120&h=160&fit=crop)' }} />
              </div>

              {/* shelf 2 */}
              <div className="relative z-10 mt-4 flex items-end gap-2 pb-0 sm:pb-1">
                <div className="h-24 w-16 shrink-0 rounded-xl bg-cover bg-center bg-no-repeat opacity-90 sm:h-30 sm:w-20" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=120&h=150&fit=crop)' }} />
                <div className="h-20 w-14 shrink-0 rounded-xl bg-cover bg-center bg-no-repeat opacity-90 sm:h-26 sm:w-18" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=120&h=140&fit=crop)' }} />
                <div className="ml-auto h-22 w-16 shrink-0 rounded-xl bg-cover bg-center bg-no-repeat opacity-90 sm:h-28 sm:w-20" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=120&h=150&fit=crop)' }} />
              </div>

              {/* phone */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="flex aspect-[9/19] items-center justify-center rounded-[2rem] border-2 border-border bg-black/70 shadow-2xl shadow-black/30 sm:aspect-[9/16] sm:rounded-[2.5rem]">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      Vidnov
                    </span>
                  </div>
                  <div className="mt-3 h-3 w-3/4 rounded-full bg-white/20" />
                  <div className="mt-1.5 h-3 w-1/2 rounded-full bg-white/15" />
                  <div className="mt-4 grid grid-cols-3 gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="aspect-square rounded-md bg-white/15" />
                    ))}
                  </div>
                </div>
              </div>

              {/* floating card */}
              <div className="absolute -right-4 top-12 z-20 max-w-[200px] rounded-2xl border border-border bg-card/90 p-3 backdrop-blur shadow-lg">
                <p className="text-xs font-semibold text-foreground">Your shop is live here</p>
                <p className="mt-1 text-[11px] text-muted-foreground">And on every connected surface.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
