'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CalendarDays, CheckCircle2, ChevronDown, Eye, Handshake, Loader2, MapPin,
  MessageSquareText, Send, Sparkles, Store, Truck, Users,
} from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import {
  createOfferDraft,
  fetchMyOffers,
  fetchMyWonRequests,
  fetchOpenRequests,
  submitOffer,
} from '@/lib/requests/client';
import type { OfferWithMedia } from '@/lib/requests/client';
import type { MarketplaceRequest } from '@/lib/requests/types';
import { budgetLabel } from '@/lib/requests/labels';
import { ensureChatWith } from '@/lib/requests/ensure-chat';
import {
  MarketplaceMediaUploader,
  type AttachedMedia,
} from '@/components/marketplace/media-uploader';
import {
  EmptyState, SellerSectionTitle,
} from '@/components/app/seller/seller-app-shell';
import { cn } from '@/lib/utils';

/**
 * SELLER APP · REQUESTS (`/app/seller/requests`).
 *
 * ## Why this screen had to exist
 *
 * Requests was the last door in the seller section that opened onto the
 * website. Everything else here is a screen the section owns, so a seller could
 * run stock, orders and messages without ever leaving the app — then tap
 * "Requests" and land in the website's chrome mid-session. That single tap
 * undid the feeling the whole section is built on.
 *
 * So this is not a link to the website's requests hub with app styling. It is
 * the seller's own implementation of the flow, written for this shell.
 *
 * ## The idea behind the layout
 *
 * A seller's day on Requests is not "browsing briefs", it is a **queue**:
 * what can I win, what did I already answer, what did I already win. So the
 * screen is three numbers first, then two queues — not a filter bar over a
 * card grid. Every number is countable from data this screen already loaded,
 * so the header costs no extra request.
 *
 * ## The whole job happens on this screen
 *
 * The website's seller flow is: list → detail page → "Take this request" →
 * offer form → send. Four steps, two of them on a different surface. Here a
 * brief **expands in place** and the entire sequence happens inline, because
 * the reason the seller opened the app was to answer, and routing them
 * somewhere else to do it would reintroduce the exact jump we removed:
 *
 *   Take the brief  → reserves the draft AND opens a direct chat with the
 *                     customer, so the conversation starts in parallel with
 *                     the offer instead of after it.
 *   Price + what they get + delivery + photos of past work.
 *   Send            → through the same authed API the website uses.
 *
 * A brief with a draft in flight resumes exactly where it was left — a seller
 * who took a job last week is not asked to take it again.
 *
 * ## Same data, one source of truth
 *
 * The same `fetchOpenRequests` / `fetchMyWonRequests` / `fetchMyOffers` client
 * calls the website uses, through the same authed API. Only the presentation
 * and the chrome are the app's.
 */

type Tab = 'open' | 'won';

export default function AppSellerRequestsPage() {
  const { user, isLoading: authLoading } = useUser();

  const [tab, setTab] = React.useState<Tab>('open');
  const [open, setOpen] = React.useState<MarketplaceRequest[] | null>(null);
  const [won, setWon] = React.useState<MarketplaceRequest[] | null>(null);
  const [offers, setOffers] = React.useState<OfferWithMedia[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  // Each queue is an independent failure. One that fails must not blank the
  // others — a seller can still win work off "Open briefs" if "My deals" 500s.
  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchOpenRequests(user)
      .then((rows) => alive && setOpen(rows.filter((r) => !r.acceptedOfferId)))
      .catch((e) => {
        if (!alive) return;
        setOpen([]);
        setError(e instanceof Error ? e.message : 'Could not load open briefs.');
      });
    return () => {
      alive = false;
    };
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMyWonRequests(user)
      .then((rows) => alive && setWon(rows))
      .catch(() => alive && setWon([]));
    return () => {
      alive = false;
    };
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMyOffers(user)
      .then((rows) => alive && setOffers(rows))
      .catch(() => alive && setOffers([]));
    return () => {
      alive = false;
    };
  }, [user]);

  /**
   * requestId → my live offer.
   *
   * Withdrawn and declined offers are dropped on purpose: a rejected offer is
   * not a lock, it is an invitation to answer again. Drafts are kept, because
   * a draft means the seller already took the job.
   */
  const myOfferByRequest = React.useMemo(() => {
    const map = new Map<string, OfferWithMedia>();
    for (const offer of offers ?? []) {
      if (offer.status === 'withdrawn' || offer.status === 'declined') continue;
      if (!map.has(offer.requestId)) map.set(offer.requestId, offer);
    }
    return map;
  }, [offers]);

  const sentCount = React.useMemo(
    () => (offers ?? []).filter((o) => o.status !== 'withdrawn' && o.status !== 'declined').length,
    [offers],
  );

  const loading = authLoading || (!open && !won);

  const stats = [
    { label: 'Open briefs', value: open?.length ?? 0, icon: Store },
    { label: 'Answers sent', value: sentCount, icon: Send },
    { label: 'Deals won', value: won?.length ?? 0, icon: Handshake },
  ];

  const rows = tab === 'open' ? open ?? [] : won ?? [];

  return (
    <div className="vn-page-enter space-y-6 pb-2">
      <SellerSectionTitle eyebrow="Request marketplace" title="Requests" />

      <p className="-mt-2 px-4 text-xs leading-relaxed text-muted-foreground">
        Customers post what they need. Take the brief, quote your price, and talk it through
        with them — all without leaving the app.
      </p>

      {/* ── The three numbers a seller is judged by here ───────────────── */}
      <section className="grid grid-cols-3 gap-2.5 px-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="vn-app-card rounded-2xl border border-border/80 bg-card px-2 py-3 text-center"
          >
            <stat.icon className="mx-auto h-3.5 w-3.5 text-primary" />
            <p className="font-grotesk mt-1.5 text-lg font-bold tabular-nums text-foreground">
              {loading ? '—' : stat.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* ── Two queues ─────────────────────────────────────────────────── */}
      <section className="px-4">
        <div className="flex gap-2">
          {(
            [
              { key: 'open' as const, label: 'Open briefs', icon: Sparkles, count: open?.length ?? 0 },
              { key: 'won' as const, label: 'My deals', icon: CheckCircle2, count: won?.length ?? 0 },
            ] satisfies { key: Tab; label: string; icon: React.ElementType; count: number }[]
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-pressed={tab === item.key}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition',
                tab === item.key
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground',
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
              <span className="tabular-nums opacity-70">{item.count}</span>
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="mx-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">Loading briefs…</span>
        </div>
      ) : rows.length === 0 ? (
        tab === 'open' ? (
          <EmptyState
            icon={Store}
            title="No matched briefs"
            body="Briefs are matched to your shop's category and location. Fill those in and the right work starts arriving here."
            action={
              <Link
                href="/app/seller/account"
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
              >
                Complete shop profile
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={Handshake}
            title="No deals won yet"
            body="When a customer accepts one of your offers it moves here so you can fulfil it and message them directly."
            action={
              <button
                type="button"
                onClick={() => setTab('open')}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
              >
                Browse open briefs
              </button>
            }
          />
        )
      ) : (
        <section className="space-y-2.5 px-4">
          {rows.map((request) => {
            const offer = myOfferByRequest.get(request.id);
            const isWon = tab === 'won';
            const isExpanded = expanded === request.id;
            const openForOffers = request.status === 'active' && !request.acceptedOfferId;

            return (
              <article
                key={request.id}
                className="vn-app-card overflow-hidden rounded-2xl border border-border/80 bg-card"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : request.id)}
                  aria-expanded={isExpanded}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                        {request.requestNumber || request.category}
                      </p>
                      <h2 className="mt-1 truncate text-base font-semibold leading-snug text-foreground">
                        {request.title}
                      </h2>
                    </div>
                    {isWon ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Won
                      </span>
                    ) : offer ? (
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider',
                          offer.status === 'submitted'
                            ? 'bg-sky-500/12 text-sky-600 dark:text-sky-400'
                            : 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {offer.status === 'submitted' ? (
                          <>
                            <Send className="h-3 w-3" /> Answered
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-3 w-3" /> In progress
                          </>
                        )}
                      </span>
                    ) : openForOffers ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Closed
                      </span>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {request.description}
                  </p>

                  <p className="font-grotesk mt-3 text-sm font-bold tabular-nums text-foreground">
                    {budgetLabel(request)}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {request.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {request.location}
                      </span>
                    )}
                    {request.deadline && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(request.deadline).toLocaleDateString()}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {request.offersCount ?? 0} competing
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {request.views ?? 0}
                    </span>
                  </div>

                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {isWon
                      ? 'Fulfil this deal'
                      : offer?.status === 'submitted'
                        ? 'View your answer'
                        : offer
                          ? 'Finish your offer'
                          : openForOffers
                            ? 'Take this brief'
                            : 'No longer open'}
                    <ChevronDown
                      className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
                    />
                  </span>
                </button>

                {isExpanded &&
                  (isWon ? (
                    <WonActions request={request} />
                  ) : openForOffers ? (
                    <OfferComposer request={request} existingOffer={offer} />
                  ) : (
                    <p className="border-t border-border/60 bg-secondary/40 p-4 text-xs text-muted-foreground">
                      This brief is no longer accepting answers.
                    </p>
                  ))}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

/**
 * Won brief: confirm the deal and get talking.
 *
 * Opening the chat is the highest-value action here — a won job that goes quiet
 * in the first day is a refund, so the button both creates the conversation and
 * lands in Messages with it already selected. `ensureChatWith` is the same
 * helper the website uses, so a conversation started here is the same chat
 * record everywhere.
 */
function WonActions({ request }: { request: MarketplaceRequest }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [opening, setOpening] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const href = `/app/seller/messages${request.customerId ? `?chatWith=${request.customerId}` : ''}`;

  if (request.customerId) {
    return (
      <div className="space-y-2.5 border-t border-border/60 bg-secondary/40 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          You won this brief. Confirm price and delivery with the customer, then fulfil it like any
          other order.
        </p>
        {failure && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive">
            {failure}
          </p>
        )}
        <button
          type="button"
          disabled={opening}
          onClick={async () => {
            if (!user || !firestore) return;
            setOpening(true);
            setFailure(null);
            try {
              await ensureChatWith(
                firestore,
                user.uid,
                request.customerId as string,
                'Conversation started from a won request.',
              );
              window.location.href = href;
            } catch {
              setFailure('Could not open the conversation. Try again.');
              setOpening(false);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
        >
          {opening ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquareText className="h-3.5 w-3.5" />
          )}
          {opening ? 'Opening…' : `Message ${request.customerName || 'the customer'}`}
        </button>
      </div>
    );
  }

  // No customer id on the record — offer the section's Messages rather than a
  // dead button, and say why instead of silently doing nothing.
  return (
    <div className="space-y-2.5 border-t border-border/60 bg-secondary/40 p-4">
      <p className="text-xs leading-relaxed text-muted-foreground">
        You won this brief. This customer can be messaged from your inbox.
      </p>
      <Link
        href="/app/seller/messages"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground"
      >
        <MessageSquareText className="h-3.5 w-3.5" /> Open messages
      </Link>
    </div>
  );
}

/**
 * Split an offer's attachments into the two buckets the uploader expects.
 * Videos must not also land in `images` — they are submitted once each, and a
 * duplicate id would be uploaded and attached twice.
 */
function splitMedia(offer: OfferWithMedia | undefined, kind: 'image' | 'video'): AttachedMedia[] {
  return (offer?.media ?? [])
    .filter((m) => m.type === kind)
    .map((m) => ({ mediaId: m.mediaId, type: m.type as 'image' | 'video' }));
}

/**
 * The offer flow, inline.
 *
 * Two states, mirroring the website's own two steps so the API contract is
 * identical:
 *
 *   1. no draft  → "Take this brief": reserve the draft (one per seller per
 *                  request) and open the line to the customer immediately.
 *   2. draft     → price, what they get, delivery, photos of past work, send.
 *
 * An existing submitted offer is read-only: the marketplace supports one offer
 * per seller per request, and silently replacing last week's quote would lose
 * work the seller may already have told the customer about.
 */
function OfferComposer({
  request,
  existingOffer,
}: {
  request: MarketplaceRequest;
  existingOffer?: OfferWithMedia;
}) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [draftId, setDraftId] = React.useState<string | null>(existingOffer?.id ?? null);
  const [price, setPrice] = React.useState(existingOffer ? String(existingOffer.price || '') : '');
  const [message, setMessage] = React.useState(existingOffer?.message ?? '');
  const [days, setDays] = React.useState(
    existingOffer?.deliveryDays ? String(existingOffer.deliveryDays) : '',
  );
  const [images, setImages] = React.useState<AttachedMedia[]>(() => splitMedia(existingOffer, 'image'));
  const [videos, setVideos] = React.useState<AttachedMedia[]>(() => splitMedia(existingOffer, 'video'));

  const [taking, setTaking] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  const submitted = existingOffer?.status === 'submitted';

  /** Step 1 — claim the job and start the conversation in the same breath. */
  const take = async () => {
    if (!user) return;
    setTaking(true);
    setFailure(null);
    try {
      const offer = await createOfferDraft(user, request.id);
      setDraftId(offer.id);
      // The seller has taken the job — open the line to the customer now, not
      // after they win it. `chatWith` needs the chat to exist first.
      if (firestore && request.customerId) {
        await ensureChatWith(firestore, user.uid, request.customerId);
      }
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not take this brief.');
    } finally {
      setTaking(false);
    }
  };

  /** Step 2 — send the quote. */
  const send = async () => {
    if (!user || !draftId) return;
    const parsed = Number(price);
    if (!parsed || parsed <= 0) {
      setFailure(`Enter the price you are quoting in ${request.currency || 'KES'}.`);
      return;
    }
    if (!message.trim()) {
      setFailure('Say what the customer gets — an offer with no description rarely wins.');
      return;
    }

    setSending(true);
    setFailure(null);
    try {
      await submitOffer(user, draftId, {
        price: parsed,
        message: message.trim(),
        deliveryDays: days ? Number(days) : null,
        mediaIds: [...images, ...videos].map((m) => m.mediaId),
      });
    } catch (err) {
      // Surface the API's own reason: a rejected offer usually means the brief
      // closed or the budget rules out the quote, and the seller needs to know
      // which — a generic "failed" would be useless.
      setFailure(err instanceof Error ? err.message : 'Could not send your offer.');
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-3 border-t border-border/60 bg-secondary/40 p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Your answer is with the customer</p>
            <p className="font-grotesk mt-0.5 text-sm font-bold tabular-nums text-foreground">
              {existingOffer?.currency || request.currency} {existingOffer?.price?.toLocaleString()}
            </p>
          </div>
        </div>

        {existingOffer?.message && (
          <p className="text-xs leading-relaxed text-muted-foreground">{existingOffer.message}</p>
        )}

        {existingOffer?.deliveryDays ? (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            Delivers in {existingOffer.deliveryDays} day
            {existingOffer.deliveryDays === 1 ? '' : 's'}
          </p>
        ) : null}

        {request.customerId && (
          <Link
            href={`/app/seller/messages?chatWith=${request.customerId}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground transition hover:bg-secondary"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            Message {request.customerName || 'the customer'}
          </Link>
        )}

        <p className="text-[11px] text-muted-foreground">
          You will be notified here the moment the customer accepts or declines.
        </p>
      </div>
    );
  }

  // Step 1 — no draft yet.
  if (!draftId) {
    return (
      <div className="space-y-3 border-t border-border/60 bg-secondary/40 p-4">
        <p className="text-sm font-semibold text-foreground">Take this brief</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Taking it claims the job and opens a direct line to the customer. You add your price and
          details next — nothing is sent until you say so.
        </p>

        {failure && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive">
            {failure}
          </p>
        )}

        <button
          type="button"
          onClick={take}
          disabled={taking}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
        >
          {taking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {taking ? 'Taking…' : 'Take this brief'}
        </button>
      </div>
    );
  }

  // Step 2 — draft reserved, fill it in.
  return (
    <div className="space-y-3.5 border-t border-border/60 bg-secondary/40 p-4">
      <p className="text-sm font-semibold text-foreground">Your offer</p>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Price ({request.currency || 'KES'})
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={request.budgetMax ? String(request.budgetMax) : '35000'}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm tabular-nums text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          What the customer gets
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Materials, dimensions, what is included, why this beats the other offers"
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
        />
      </label>

      <label className="block">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Truck className="h-3 w-3" /> Delivery (days)
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="14"
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-3 text-sm tabular-nums text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
        />
      </label>

      <div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Show your work
        </span>
        <div className="mt-1.5">
          <MarketplaceMediaUploader
            user={user ?? null}
            offerId={draftId}
            images={images}
            videos={videos}
            onChange={(next) => {
              setImages(next.images);
              setVideos(next.videos);
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          Photos of past work are the single biggest reason an offer wins. Up to 5 photos and 2
          short videos.
        </p>
      </div>

      {failure && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive">
          {failure}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold uppercase tracking-wider text-primary-foreground transition disabled:opacity-60"
      >
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {sending ? 'Sending…' : 'Send offer'}
      </button>
    </div>
  );
}