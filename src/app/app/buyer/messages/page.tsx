'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { BuyerMessages } from '@/components/app/buyer/messages/buyer-messages';

/**
 * BUYER APP · MESSAGES (`/app/buyer/messages`).
 *
 * ## How a buyer gets here
 *
 *   - the chat bubble on any card in the shop feed
 *   - "Message seller" on a product screen
 *   - the Messages entry in the buyer menu
 *
 * The first two arrive as `?chatWith=<sellerId>`, which opens (or creates) that
 * conversation immediately, so tapping chat on a product lands the buyer in a
 * conversation with that product's seller rather than in a list they then have
 * to search.
 *
 * ## Sizing
 *
 * The thread owns the full height of the shell's `main` — it scrolls its own
 * message list and pins the composer to the bottom, which is the only way a
 * chat reads correctly on a phone. The shell root is `min-h-screen`, and a
 * percentage height against a min-height parent does not reliably resolve, so
 * the height is explicit.
 *
 * `/app/buyer/messages` is an immersive route, so the shell gives it the slim
 * h-12 menu/back bar and no tab bar, and `main` adds `pb-2 pt-0`. That is
 * 3rem + 0.5rem, hence `calc(100dvh - 3.5rem)`. It used to be `- 5rem` against
 * the full header; going immersive is what freed the space, so the subtraction
 * had to follow or the thread would have ended short with a dead strip under
 * the composer.
 *
 * `dvh` rather than `vh` because on mobile `vh` excludes the collapsing URL
 * bar, which leaves the composer under the browser chrome exactly when a
 * keyboard opens.
 */
export default function BuyerMessagesPage() {
  return (
    <div className="flex flex-col px-3 pb-3" style={{ height: 'calc(100dvh - 3.5rem)' }}>
      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-border/70 bg-background">
        <React.Suspense
          fallback={
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <p className="vn-micro text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Opening your inbox
              </p>
            </div>
          }
        >
          <BuyerMessages />
        </React.Suspense>
      </div>
    </div>
  );
}
