'use client';

import * as React from 'react';

const MOMENT = {
  src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=520&fit=crop',
  alt: 'Vendor and shopper examining a product together',
};

const CHAT_BUBBLES = [
  { who: 'Buyer', text: 'Can you hold this for me until Friday?', mine: false },
  { who: 'You', text: 'Absolutely — I will keep it aside.', mine: true },
  { who: 'Buyer', text: 'That is perfect, thank you.', mine: false },
];

export function VendorMeetsBuyer() {
  return (
    <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* copy */}
        <div className="lg:col-span-5">
          <span className="vn-phase text-primary">The handshake moment</span>
          <h2 className="vn-display mt-4 text-balance text-4xl text-foreground sm:text-5xl lg:text-6xl">
            A seller and a buyer,{'*'}\
            <br />
            <span className="vn-text-grad">finally in the same room.</span>
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            Most selling happens in fragments — a DM, a comment, a phone call, a
            screenshot. Vidnov brings it back to one place where the buyer can
            see the product, ask the question and pay without leaving the listing,
            and the seller can see exactly what was asked and when.
          </p>

          <ul className="mt-8 space-y-2.5">
            {[
              'Questions stay with the listing, not in a private DM',
              'The offer is visible, the price is visible, the answer is visible',
              'No more chasing payment outside the product page',
              'The buyer sees a real shop, not a one-off post',
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
              Start the conversation
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

        {/* visual */}
        <div className="relative lg:col-span-7">
          <div className="vn-shadow relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
            {/* room background */}
            <div className="relative">
              {/* back wall */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/8 via-transparent to-accent/8" />

              {/* window light */}
              <div className="absolute top-4 right-6 h-24 w-32 rounded-2xl bg-gradient-to-b from-amber-200/30 to-white/10 blur-xl" />

              {/* wall picture */}
              <div className="absolute top-10 right-6 h-16 w-20 rounded-lg border border-border bg-muted/40" />

              {/* floor hint */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-muted/10 to-transparent" />

              {/* main photo behind */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[4/3] w-4/5 overflow-hidden rounded-2xl shadow-xl">
                <img
                  src={MOMENT.src}
                  alt={MOMENT.alt}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>

              {/* people cutouts — simple silhouettes layered */}
              <div className="absolute left-8 top-1/2 -translate-y-1/2 z-10">
                {/* seller */}
                <div className="flex items-end gap-1">
                  <div className="h-10 w-10 rounded-full bg-primary/40 ring-2 ring-primary/30" />
                  <div className="mt-1.5 h-5 w-5 rounded-full bg-amber-800/70" />
                </div>
              </div>

              <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10">
                {/* buyer */}
                <div className="flex items-end gap-1">
                  <div className="h-10 w-10 rounded-full bg-neutral-600/40 ring-2 ring-neutral-500/30" />
                  <div className="mt-1.5 h-5 w-5 rounded-full bg-amber-900/70" />
                </div>
              </div>

              {/* floating chat */}
              <div className="absolute -bottom-3 left-6 z-20 max-w-[220px] rounded-2xl border border-border bg-card/95 p-3 backdrop-blur shadow-lg">
                <div className="space-y-2">
                  {CHAT_BUBBLES.map((b, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        b.mine ? 'ml-0 rounded-br-sm bg-primary/10 text-foreground' : 'mr-0 rounded-bl-sm bg-muted text-foreground'
                      }`}
                    >
                      {b.text}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{CHAT_BUBBLES[2].who}</span>
                  <span>· 2 min ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
