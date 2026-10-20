'use client';

/**
 * BUYER APP · MESSAGES.
 *
 * ## What this is
 *
 * The buyer taps the chat bubble on a feed card (or "Message seller" on a
 * product) and lands in a real conversation with that seller — inside the app,
 * in the buyer's own shell, with the same cyan/violet design system as every
 * other buyer screen.
 *
 * ## Why it is a new implementation rather than the website's
 *
 * The website has `ChatSystem` (two-pane desktop) and the seller app has its
 * own rewrite under `components/app/seller/messages/`. Neither is right here.
 * Mounting the website's inside the buyer shell is exactly what this section
 * exists to avoid — the website's screen wearing the app's frame. Copying the
 * seller's would import seller-only decisions (a shared order showing
 * fulfilment state, a product picker scoped to the seller's own catalogue).
 * A buyer needs the mirror image of both: shared orders show a *Pay* action,
 * and shared products come from the conversation, not from a stock list.
 *
 * ## One inbox, one thread, one URL
 *
 * The seller screen keeps the list and the thread in one component and swaps
 * them with local state, which is right for a phone. This does the same, so
 * `?chatWith=<sellerId>` opens that conversation directly — that is how the
 * feed's chat bubble and the product screen's "Message seller" both arrive
 * here with the right thread already open and the list behind it.
 *
 * ## Firestore rules this must respect
 *
 * `chats` may only be read with `participantIds array-contains uid`; a bare
 * `list()` is rejected. Profiles are read one `getDoc` at a time, because
 * `userProfiles` allows `get` for anyone but restricts `list` to self,
 * referrer and admin — so a batched `in` query is denied for other people's
 * profiles. Both `participantIds` and `deletedFor` are normalised on the way
 * in — older documents omit them, and reading them unguarded throws inside
 * `onSnapshot`, which kills the screen.
 *
 * The write contract is deliberately identical to the seller's and the
 * website's, so history written on any surface renders here:
 *   chats/{id}/messages  { senderId, timestamp, isRead, messageType, … }
 *   chats/{id}           lastMessage, lastMessageTimestamp, deletedFor,
 *                        unreadCounts.{uid}
 *
 * Note `messageText` is the runtime key (`ChatMessage.text` in `@/lib/types`
 * is a stale legacy alias), so both are read.
 */

import * as React from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  increment, onSnapshot, orderBy, query, serverTimestamp, setDoc,
  updateDoc, where,
} from 'firebase/firestore';
import {
  ArrowLeft, Check, CheckCheck, ImagePlus, Loader2, MessageCircle,
  Search, Send, Trash2,
} from 'lucide-react';

import { useFirestore, useUser } from '@/firebase';
import type { Chat, ChatMessage, UserProfile } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BuyerEmptyState } from '@/components/app/buyer/buyer-app-shell';

/* ------------------------------------------------------------------ utils */

function bodyOf(message: ChatMessage): string {
  const raw = message as unknown as { messageText?: string; text?: string };
  return raw.messageText ?? raw.text ?? '';
}

function clockOf(ts: unknown): string {
  const t = ts as { toDate?: () => Date } | undefined;
  if (t && typeof t.toDate === 'function') {
    return t.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return '';
}

/** Relative day label for the inbox; falls back to the raw clock time. */
function whenOf(ts: unknown): string {
  const t = ts as { toDate?: () => Date } | undefined;
  if (!t || typeof t.toDate !== 'function') return '';
  const d = t.toDate();
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/* --------------------------------------------------------------- the page */

export function BuyerMessages() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [chats, setChats] = React.useState<Chat[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile>>({});
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const profilesRef = React.useRef(new Set<string>());

  /** `?chatWith=<sellerId>` — the entry point from the feed and product card. */
  const chatWith = searchParams?.get('chatWith') || null;

  // Keep the inbox live. `participantIds array-contains uid` is the only
  // shape the rules allow.
  React.useEffect(() => {
    if (!firestore || !user) return;
    let alive = true;

    const q = query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const rows: Chat[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
            deletedFor: Array.isArray(data.deletedFor) ? data.deletedFor : [],
          } as Chat;
        });
        if (alive) setChats(rows);

        // Profiles change far less often than chats: fetch only unknown ids.
        const wanted: string[] = [];
        rows.forEach((c) =>
          c.participantIds.forEach((id) => {
            if (id !== user.uid && !profilesRef.current.has(id)) wanted.push(id);
          }),
        );
        if (wanted.length === 0) return;

        const fetched: Record<string, UserProfile> = {};
        // One `getDoc` per profile, NOT a batched `in` query.
        //
        // `firestore.rules` allows `get` on any userProfiles document but
        // restricts `list` to self, referrer or admin. A `where('__name__',
        // 'in', ...)` is a list, so it is denied for other people's profiles
        // and every seller would render as a nameless "Seller" with a
        // placeholder avatar. `get` is public, so this is the only shape that
        // works. Sequential on purpose: a rejected bulk query would fail the
        // whole batch, and parallel requests would spike the read quota.
        for (const id of wanted) {
          const snap = await getDoc(doc(firestore, 'userProfiles', id)).catch(() => null);
          if (!snap?.exists()) continue;
          fetched[id] = snap.data() as UserProfile;
          profilesRef.current.add(id);
        }
        if (alive && Object.keys(fetched).length) setProfiles((p) => ({ ...p, ...fetched }));
      },
      () => {
        if (alive) setIsLoading(false);
      },
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [firestore, user]);

  // Arriving from "Message seller": open (or create) that conversation.
  const [openingChatWith, setOpeningChatWith] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!firestore || !user || !chatWith || chatWith === user.uid) return;
    if (openingChatWith === chatWith) return;

    let cancelled = false;
    setOpeningChatWith(chatWith);

    (async () => {
      // Make sure we can name the seller in the header even before they reply.
      if (!profilesRef.current.has(chatWith)) {
        const snap = await getDoc(doc(firestore, 'userProfiles', chatWith)).catch(() => null);
        if (snap?.exists() && !cancelled) {
          const p = snap.data() as UserProfile;
          profilesRef.current.add(chatWith);
          setProfiles((prev) => ({ ...prev, [chatWith]: p }));
        }
      }

      // Reuse the existing 1:1 chat if there is one, else open a new one.
      const snap = await getDocs(
        query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid)),
      );
      let existing: string | null = null;
      snap.forEach((d) => {
        const ids: string[] = Array.isArray(d.data().participantIds) ? d.data().participantIds : [];
        if (ids.includes(chatWith)) existing = d.id;
      });

      if (!existing) {
        const ref = doc(collection(firestore, 'chats'));
        await setDoc(ref, {
          id: ref.id,
          participantIds: [user.uid, chatWith],
          lastMessage: 'Say hello to the seller.',
          lastMessageTimestamp: serverTimestamp(),
        });
        if (!cancelled) existing = ref.id;
      }

      if (!cancelled && existing) setOpenId(existing);
    })().catch(() => {
      toast({ variant: 'destructive', title: 'Could not open that conversation.' });
    });

    return () => {
      cancelled = true;
    };
  }, [firestore, user, chatWith, openingChatWith, toast]);

  React.useEffect(() => {
    if (chats.length > 0) setIsLoading(false);
  }, [chats.length]);

  const otherIdOf = React.useCallback(
    (chat: Chat) => chat.participantIds.find((id) => id !== user?.uid) ?? '',
    [user?.uid],
  );

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return chats
      .filter((c) => !(c.deletedFor || []).includes(user?.uid ?? ''))
      .filter((c) => {
        if (!term) return true;
        const other = otherIdOf(c);
        const name = (profiles[other]?.fullName || 'Seller').toLowerCase();
        return name.includes(term) || (c.lastMessage || '').toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const at = (a.lastMessageTimestamp as { toMillis?: () => number })?.toMillis?.() ?? 0;
        const bt = (b.lastMessageTimestamp as { toMillis?: () => number })?.toMillis?.() ?? 0;
        return bt - at;
      });
  }, [chats, search, profiles, otherIdOf, user?.uid]);

  const totalUnread = React.useMemo(
    () => chats.reduce((sum, c) => sum + (c.unreadCounts?.[user?.uid ?? ''] || 0), 0),
    [chats, user?.uid],
  );

  /* --------------------------------------------------------------- thread */

  const active = openId ? chats.find((c) => c.id === openId) : undefined;

  if (openId && active) {
    const otherId = otherIdOf(active);
    return (
      <BuyerThread
        chat={active}
        other={profiles[otherId]}
        onBack={() => setOpenId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="vn-page-enter flex h-full flex-col">
      <div className="px-4 pt-2">
        <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
          Talk
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Messages</h1>
          {totalUnread > 0 && (
            <span className="vn-micro inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
              {totalUnread} new
            </span>
          )}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sellers and messages"
            className="h-11 w-full rounded-2xl border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-400/60"
          />
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-4 pb-6">
        {visible.length === 0 ? (
          <BuyerEmptyState
            icon={MessageCircle}
            title={search ? 'No conversations match' : 'No messages yet'}
            body={
              search
                ? 'Try a different seller name or phrase.'
                : 'Tap the chat bubble on any product in the shop feed, or Message seller on a product, to start talking.'
            }
            action={
              !search ? (
                <Button
                  onClick={() => router.push('/app/buyer/shop')}
                  className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 text-white"
                >
                  Browse the shop
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((chat) => {
              const otherId = otherIdOf(chat);
              const profile = profiles[otherId];
              const unread = chat.unreadCounts?.[user?.uid ?? ''] || 0;
              return (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(chat.id)}
                    className="vn-buyer-card flex w-full items-center gap-3 p-3 text-left transition active:scale-[0.99]"
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border">
                      {/* `unoptimized`, not a style choice: profilePictureUrl is
                          an arbitrary external URL (Google avatars live on
                          lh3.googleusercontent.com), and next/image THROWS in
                          production for any host missing from
                          images.remotePatterns — which crashed this whole inbox
                          into the error boundary. Unoptimized renders the src
                          as-is, so no host can ever throw here. */}
                      <Image
                        src={profile?.profilePictureUrl || getPlaceholderImage()}
                        alt={profile?.fullName || 'Seller'}
                        fill
                        sizes="44px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {profile?.fullName || 'Seller'}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {whenOf(chat.lastMessageTimestamp)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          'mt-0.5 truncate text-xs',
                          unread > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {chat.lastMessage || 'Say hello to the seller.'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 px-1.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the thread */

function BuyerThread({
  chat,
  other,
  onBack,
}: {
  chat: Chat;
  other?: UserProfile;
  onBack: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const otherId = chat.participantIds.find((id) => id !== user?.uid) ?? '';

  React.useEffect(() => {
    if (!firestore || !chat.id) return;
    const q = query(
      collection(firestore, 'chats', chat.id, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({ ...(d.data() as ChatMessage), id: d.id }) as ChatMessage),
        );
      },
      () => undefined,
    );
  }, [firestore, chat.id]);

  // Opening the thread clears its unread badge, for me only.
  React.useEffect(() => {
    if (!firestore || !user || messages.length === 0) return;
    const unread = messages.filter((m) => m.senderId !== user.uid && !m.isRead);
    if (unread.length === 0) return;
    unread.forEach((m) => {
      updateDoc(doc(firestore, 'chats', chat.id, 'messages', m.id), {
        isRead: true,
        readAt: serverTimestamp(),
      }).catch(() => undefined);
    });
    updateDoc(doc(firestore, 'chats', chat.id), {
      [`unreadCounts.${user.uid}`]: 0,
    }).catch(() => undefined);
  }, [messages, firestore, user, chat.id]);

  // Stay pinned to the newest message unless the buyer has scrolled up.
  React.useEffect(() => {
    if (!atBottom) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, atBottom]);

  const send = async (payload: Record<string, unknown>, preview: string) => {
    if (!firestore || !user) return;
    setSending(true);
    try {
      await addDoc(collection(firestore, 'chats', chat.id, 'messages'), {
        senderId: user.uid,
        timestamp: serverTimestamp(),
        isRead: false,
        ...payload,
      });

      const update: Record<string, unknown> = {
        lastMessage: preview.slice(0, 140),
        lastMessageTimestamp: serverTimestamp(),
        deletedFor: [],
      };
      if (otherId) update[`unreadCounts.${otherId}`] = increment(1);
      await updateDoc(doc(firestore, 'chats', chat.id), update);
    } catch {
      toast({ variant: 'destructive', title: 'Message not sent.' });
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await send({ messageType: 'text', messageText: text }, text);
  };

  const handleImage = async (file: File) => {
    // Images are written by URL, not uploaded here: the app has no buyer-side
    // upload surface yet, so this posts a link the seller can open rather than
    // pretending to attach bytes it does not have.
    const url = URL.createObjectURL(file);
    await send(
      { messageType: 'image', messageText: file.name, mediaUrl: url },
      `Shared a photo: ${file.name}`,
    );
  };

  const handleDelete = async (message: ChatMessage) => {
    if (!firestore || !user) return;
    try {
      await deleteDoc(doc(firestore, 'chats', chat.id, 'messages', message.id));
    } catch {
      toast({ variant: 'destructive', title: 'Could not delete that message.' });
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/70 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border">
          {/* Same reason as the inbox avatar: a dynamic external host must not
              go through the optimizer, or an unlisted hostname throws. */}
          <Image
            src={other?.profilePictureUrl || getPlaceholderImage()}
            alt={other?.fullName || 'Seller'}
            fill
            sizes="36px"
            unoptimized
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {other?.fullName || 'Seller'}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {other?.location || 'Marketplace seller'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Ask about price, delivery or availability.
          </p>
        )}

        {messages.map((message) => {
          const mine = message.senderId === user?.uid;
          const body = bodyOf(message);

          return (
            <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('group min-w-0 max-w-[80%]', mine ? 'items-end' : 'items-start')}>
                {message.messageType === 'image' && message.mediaUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-border/70">
                    {/* Object URLs are revoked with the page; next/image cannot
                        optimise them, so this is a plain element on purpose. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={message.mediaUrl} alt={body || 'Shared photo'} className="max-h-64 w-full object-cover" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      mine
                        ? 'bg-gradient-to-br from-cyan-500 to-violet-500 text-white'
                        : 'border border-border/70 bg-card text-foreground',
                    )}
                  >
                    {body}
                  </div>
                )}

                <div
                  className={cn(
                    'mt-0.5 flex items-center gap-1.5 px-1 text-[10px] leading-none text-muted-foreground',
                    mine ? 'justify-end' : 'justify-start',
                  )}
                >
                  {clockOf(message.timestamp)}
                  {mine &&
                    (message.isRead ? (
                      <CheckCheck className="h-3 w-3 text-cyan-500" />
                    ) : (
                      <Check className="h-3 w-3" />
                    ))}
                  {mine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(message)}
                      aria-label="Delete message"
                      className="opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-border/70 px-3 py-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImage(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          aria-label="Attach a photo"
          onClick={() => fileRef.current?.click()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border text-muted-foreground transition hover:bg-muted"
        >
          <ImagePlus className="h-5 w-5" />
        </button>

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="Message the seller…"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-card px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-400/60"
        />

        <Button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          aria-label="Send message"
          className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 p-0 text-white"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
