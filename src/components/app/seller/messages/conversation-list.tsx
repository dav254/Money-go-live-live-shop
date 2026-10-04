'use client';

import * as React from 'react';
import { Loader2, MessageSquare, Search, X } from 'lucide-react';
import type { Chat, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * A conversation joined with the person on the other end of it.
 *
 * `otherParticipant` is `UserProfile | undefined`, not `| null`, so a
 * `Conversation` stays assignable to `Chat` (which declares the field the same
 * way). Using `null` here made every hand-off to the thread a type error.
 */
export type Conversation = Chat & {
  /** This seller's own unread count, read from `unreadCounts[uid]`. */
  unreadCount: number;
};

const ONLINE_WINDOW_MS = 120_000;

/**
 * SELLER APP · CONVERSATION LIST.
 *
 * ## The search actually works
 *
 * The website's inbox shows a search box but wires nothing to it — typing does
 * nothing, which on a seller inbox is worse than having no search at all,
 * because a seller with 80 conversations believes they already looked
 * everywhere. Here the query is real: it filters on the other party's name and
 * on the last message, and it can be cleared.
 *
 * ## Ordering is by conversation, not by sender
 *
 * The website sorts by `lastMessageTimestamp`, so a chat bubble can never be
 * empty and never floats to the top on its own. Here each row keeps its last
 * message visible, which is the one thing a seller scanning the list needs.
 */
export function SellerConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (chat: Conversation) => void;
  isLoading: boolean;
}) {
  const [term, setTerm] = React.useState('');
  const query = term.trim().toLowerCase();

  const visible = React.useMemo(() => {
    if (!query) return conversations;
    return conversations.filter((c) => {
      const name = c.otherParticipant?.fullName?.toLowerCase() ?? '';
      const last = c.lastMessage?.toLowerCase() ?? '';
      return name.includes(query) || last.includes(query);
    });
  }, [conversations, query]);

  const unreadTotal = React.useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0),
    [conversations],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header + search */}
      <div className="shrink-0 border-b border-border/70 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-grotesk text-base font-bold text-foreground">Messages</h2>
          {unreadTotal > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">
              {unreadTotal > 99 ? '99+' : unreadTotal} new
            </span>
          )}
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search buyers and messages"
            aria-label="Search conversations"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading && conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em]">Loading</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-grotesk mt-4 text-sm font-semibold text-foreground">
              {query ? 'No conversations match' : 'No conversations yet'}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {query
                ? `Nothing found for “${term.trim()}”.`
                : 'When a buyer messages you about a listing or an order, it lands here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((chat) => {
              const other = chat.otherParticipant;
              const active = selectedId === chat.id;
              const unread = chat.unreadCount ?? 0;
              const online = !!other?.lastSeen && Date.now() - other.lastSeen.toMillis() < ONLINE_WINDOW_MS;

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => onSelect(chat)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition',
                    active
                      ? 'bg-primary/10 ring-1 ring-primary/40'
                      : 'hover:bg-secondary/70',
                  )}
                >
                  <span className="relative shrink-0">
                    {other?.profilePictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={other.profilePictureUrl}
                        alt=""
                        className="h-11 w-11 rounded-full border border-border object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-grotesk text-sm font-bold text-muted-foreground">
                        {(other?.fullName || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
                        online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                      )}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          unread > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground',
                        )}
                      >
                        {other?.fullName || 'Buyer'}
                      </span>
                      {chat.lastMessageTimestamp && (
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {formatStamp(chat.lastMessageTimestamp)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-xs',
                          unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {chat.lastMessage || 'Say hello'}
                      </span>
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-primary-foreground">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Today shows the clock; anything older shows the day. */
function formatStamp(ts: { toDate: () => Date }): string {
  const date = ts.toDate();
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}