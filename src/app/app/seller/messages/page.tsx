'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { SellerMessages } from '@/components/app/seller/messages/seller-messages';

/**
 * SELLER APP · MESSAGES (`/app/seller/messages`).
 *
 * ## Why the section was rewritten
 *
 * This screen originally mounted the website's `ChatSystem` inside the seller
 * shell. That produced the exact thing the section exists to avoid: the
 * seller tapped "Messages" in the app and got the website's screen wearing the
 * app's frame — a two-pane desktop layout, a search box wired to nothing, and a
 * "PAY NOW" button inside a chat bubble, asking a seller to pay their own
 * invoice.
 *
 * The implementation behind this page now lives in
 * `src/components/app/seller/messages/` and belongs to this section:
 *
 *   seller-messages.tsx    owns the Firestore reads and list ↔ thread routing
 *   conversation-list.tsx  the inbox, with a search that actually filters
 *   thread.tsx             bubbles, media, voice notes, shared products/orders
 *
 * It is the website's feature set — deliberately — because a seller talking to
 * a buyer does not need fewer tools for being in the app. What changes is the
 * chrome, and the two decisions that only make sense for a seller: products
 * come from their own catalogue, and a shared order shows fulfilment state
 * instead of a payment button.
 *
 * The documents are the same ones the website writes, so history written on
 * either surface renders here and messages sent here appear there.
 */
export default function AppSellerMessagesPage() {
  return (
    // The shell renders this route in immersive mode: no tab bar, and a header
    // shortened to `h-12` holding only the menu and back controls. So the only
    // chrome left to clear is that 3rem header — which is why the card is both
    // taller and wider than before. Everything the tab bar carried is still one
    // tap away behind the menu button.
    //
    // Explicit height rather than `h-full`: the shell root is `min-h-screen`,
    // and a percentage height against a min-height parent does not reliably
    // resolve — when it doesn't, the thread collapses instead of filling.
    <div
      className="flex flex-col px-2 pb-2"
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/80 bg-card">
        <React.Suspense
          fallback={
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Opening your inbox
              </p>
            </div>
          }
        >
          <SellerMessages />
        </React.Suspense>
      </div>
    </div>
  );
}