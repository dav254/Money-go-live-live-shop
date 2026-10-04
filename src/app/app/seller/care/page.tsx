'use client';

/**
 * SELLER APP · CUSTOMER CARE.
 *
 * A direct line to the platform, from inside the app. It is deliberately
 * called Customer Care and never "admin": the seller is not talking to a
 * person with a console role, they are talking to the team that runs their
 * shop — and the name is the promise that this is a support channel, not a
 * back door into the staff console.
 *
 * ## Why it is its own thread and not a chat with a fake contact
 *
 * `chats` is peer-to-peer: every document carries `participantIds`, and
 * `firestore.rules` only lets a signed-in user read a chat they are in. A
 * platform contact would have to be a real user account, be added to every
 * seller's participant list, and would drag every seller conversation that
 * exists into the buyer's inbox. So this uses its own collection.
 *
 * ## The shape
 *
 * `supportThreads/{myUid}` — one thread per seller, keyed by their own id, and
 * `.../messages/{messageId}` beneath it. Keying by the seller's uid is what
 * lets the rules stay this tight:
 *
 *   • the seller reads and writes only their own thread
 *   • the platform reads every thread, and posts into any of them
 *
 * There is no query here that can return somebody else's conversation, and no
 * list over `supportThreads` at all — the seller always knows their own id and
 * goes straight to it. Messages are append-only: once a message is in, nobody
 * edits or deletes it, so what each side said stays on the record.
 *
 * Reads come off the seller's own ledger and their payout requests, because
 * most of what people open Customer Care for is money: "was I paid", "where is
 * my payout", "who do I send the receipt to". Those answers should not have to
 * be asked.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  BadgeCheck,
  Headphones,
  Landmark,
  Loader2,
  Wallet,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { PAYOUT_STATUS_LABEL } from '@/lib/types';
import type { Payout } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  SellerCard,
  SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';

/** A message in the seller's Customer Care thread. */
interface CareMessage {
  id: string;
  text?: string;
  senderId?: string;
  senderName?: string;
  /** 'seller' is the person reading this screen; 'care' is the platform. */
  from?: string;
  createdAt?: unknown;
}

function millis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in (value as { toMillis?: unknown })) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}

const clock = (value: unknown) => {
  const ms = millis(value);
  if (!ms) return '';
  const date = new Date(ms);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Context cards the seller can drop into the thread with one tap. */
const QUICK_ASKS = [
  'I have not been paid for a sale yet.',
  'Where do I change where my money goes?',
  'A buyer has not paid yet. What should I do?',
  'I need help with my shop listing.',
] as const;

export default function SellerSectionCare() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [draft, setDraft] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // The thread lives at the seller's own uid, so this is a direct get rather
  // than a collection read — there is no list over `supportThreads` anywhere in
  // this app.
  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'supportThreads', user.uid, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200),
    );
  }, [firestore, user]);
  const { data: messages, isLoading: isLoadingMessages } = useCollection<CareMessage>(messagesQuery);

  // Money context, so the agent answering has the numbers in front of them and
  // the seller can see where they stand without leaving the thread.
  const payoutsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'payouts'),
      where('sellerId', '==', user.uid),
      limit(20),
    );
  }, [firestore, user]);
  const { data: payouts } = useCollection<Payout>(payoutsQuery);

  const latestPayout = React.useMemo(() => {
    const rows = (payouts ?? []).slice();
    if (rows.length === 0) return null;
    return rows.sort((a, b) => millis(b.requestedAt) - millis(a.requestedAt))[0];
  }, [payouts]);

  const messagesEnd = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || !user || !firestore || isSending) return;
    setIsSending(true);
    try {
      const threadRef = doc(firestore, 'supportThreads', user.uid);
      // The thread document is created on first message, so a seller who has
      // never written to us still has somewhere the platform can write back.
      await setDoc(
        threadRef,
        { sellerId: user.uid, lastMessageAt: serverTimestamp() },
        { merge: true },
      );
      await addDoc(collection(firestore, 'supportThreads', user.uid, 'messages'), {
        text: body,
        senderId: user.uid,
        senderName: user.displayName || 'Seller',
        from: 'seller',
        createdAt: serverTimestamp(),
      });
      setDraft('');
    } catch (err) {
      console.error('Error sending Customer Care message:', err);
      toast({
        variant: 'destructive',
        title: 'Message not sent',
        description: 'Check your connection and try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <SellerSectionTitle eyebrow="Support" title="Customer Care" />

      {/* Who this is. The header says "Customer Care" and nothing else — the
          seller is talking to the team, not auditing the staff console. */}
      <section className="px-4">
        <div className="vn-seller-band vn-app-card overflow-hidden rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Headphones className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-grotesk text-base font-bold text-white">Customer Care</p>
              <p className="flex items-center gap-1.5 text-[11px] text-white/75">
                <BadgeCheck className="h-3.5 w-3.5" />
                The Vidnov team — usually within a few hours
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-white/80">
            Ask about a payment, a payout, an order or your shop. This thread is only
            between you and us.
          </p>
        </div>
      </section>

      {/* Money context — the two things people actually open Customer Care
          for. Reads the same data the Payments screen does. */}
      <section className="grid grid-cols-2 gap-2.5 px-4">
        <Link
          href="/app/seller/payments"
          className="vn-app-card rounded-2xl border border-border/80 bg-card p-3.5 transition active:scale-[0.99]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Landmark className="h-4 w-4" />
          </span>
          <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Paid to
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            Add your details
          </p>
        </Link>
        <Link
          href="/app/seller/payments"
          className="vn-app-card rounded-2xl border border-border/80 bg-card p-3.5 transition active:scale-[0.99]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <Wallet className="h-4 w-4" />
          </span>
          <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Last request
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {latestPayout
              ? PAYOUT_STATUS_LABEL[latestPayout.status] ?? latestPayout.status
              : 'None yet'}
          </p>
        </Link>
      </section>

      {/* The thread */}
      <section className="px-4">
        <SellerCard className="vn-app-card overflow-hidden p-0">
          <div
            ref={scrollRef}
            className="max-h-[52dvh] min-h-[16rem] space-y-2.5 overflow-y-auto overscroll-contain p-3.5"
          >
            {isLoadingMessages ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="vn-skeleton h-12 w-full rounded-2xl" />
                ))}
              </div>
            ) : !messages || messages.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Headphones className="h-5 w-5 text-muted-foreground" />
                </span>
                <p className="font-grotesk mt-4 text-base font-semibold text-foreground">
                  Start the conversation
                </p>
                <p className="mt-1.5 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
                  Anything you send here reaches the team directly. Pick one of the
                  questions below, or write your own.
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const mine = message.from === 'seller';
                const previous = messages[index - 1];
                const showStamp =
                  !previous ||
                  message.from !== previous.from ||
                  millis(message.createdAt) - millis(previous.createdAt) > 5 * 60 * 1000;
                return (
                  <div
                    key={message.id}
                    className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                  >
                    <div className={cn('max-w-[85%] space-y-1', mine && 'items-end')}>
                      {!mine && showStamp && (
                        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {message.senderName || 'Customer Care'}
                        </p>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                          mine
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-secondary text-foreground rounded-bl-md',
                        )}
                      >
                        {message.text}
                      </div>
                      {showStamp && (
                        <p className="px-1 text-[10px] text-muted-foreground">
                          {clock(message.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Composer */}
          <div className="border-t border-border/70 bg-secondary/30 p-3">
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {QUICK_ASKS.map((ask) => (
                <button
                  key={ask}
                  type="button"
                  onClick={() => setDraft(ask)}
                  className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  {ask}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends on a keyboard, Shift+Enter is a newline. On a
                  // phone the Enter key is not the send affordance, so the
                  // button stays the primary way to send.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={1}
                placeholder="Message Customer Care"
                aria-label="Message Customer Care"
                className="max-h-28 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-input bg-card px-3.5 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => void send(draft)}
                disabled={!draft.trim() || isSending}
                aria-label="Send message"
                className="h-11 w-11 shrink-0 rounded-2xl"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SellerCard>
      </section>

      <div className="px-4">
        <SellerCard className="vn-app-card bg-secondary/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Keep it in one place
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Customer Care is for the team. Buyer conversations belong in Messages, and a
            dispute about an order is faster through a report on the order itself — it
            puts the order in front of us instead of in a screenshot.
          </p>
          <Link
            href="/app/seller/messages"
            className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
          >
            Go to Messages
          </Link>
        </SellerCard>
      </div>
    </div>
  );
}