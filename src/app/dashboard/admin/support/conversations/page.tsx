'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { PartyConversation } from '@/components/admin/party-conversation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useChats } from '@/lib/chat/use-chat';
import type { Chat, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MessagesSquare, Search, ArrowLeft } from 'lucide-react';

/**
 * ADMIN · SELLER & BUYER CONVERSATIONS (`/dashboard/admin/support/conversations`).
 *
 * The moderation consoles showed WHAT was reported but never WHAT WAS SAID: an
 * admin mediating a seller/buyer dispute had to ask both parties to screenshot
 * their own chat. This section is the oversight view — every conversation on
 * the platform, with both participants named and badged by role, and the full
 * transcript readable in place.
 *
 * Reads go through the VPS message store (`useChats` → `GET /api/chat?scope=all`),
 * which is admin-scoped on the server: a verified admin token gets every
 * conversation, anybody else is refused. Profiles still come from
 * `userProfiles` through public `get()` reads. The list polls and refreshes on
 * focus, so a conversation that flares up while the admin is looking at it
 * still updates on its own.
 *
 * Read-only by design (see `PartyConversation`): an admin typing into a private
 * thread would appear mid-argument as a third party.
 */

const ChatRowSkeleton = () => (
  <div className="space-y-2 p-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 p-3">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted/60" />
        </div>
      </div>
    ))}
  </div>
);

export default function AdminConversationsPage() {
  const firestore = useFirestore();

  const {
    chats: liveChats,
    isLoading: chatsLoading,
    error: chatsError,
  } = useChats({ scope: 'all' });

  const [chats, setChats] = React.useState<Chat[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [profiles, setProfiles] = React.useState<Record<string, UserProfile | null>>({});
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Chat | null>(null);

  // One cache for the life of the page: profiles change far less often than
  // messages, and every chat row needs up to two of them.
  const profilesRef = React.useRef<Record<string, UserProfile | null>>({});

  React.useEffect(() => {
    if (!firestore) return;
    let alive = true;

    // Fill any profile the cache has not seen yet (get() is publicly
    // readable; list() would be denied even to these participants).
    const wanted = new Set<string>();
    liveChats.forEach((chat) => {
      chat.participantIds.forEach((id) => {
        if (!(id in profilesRef.current)) wanted.add(id);
      });
    });

    (async () => {
      for (const id of wanted) {
        const snap = await getDoc(doc(firestore, 'userProfiles', id)).catch(() => null);
        profilesRef.current[id] = snap?.exists() ? (snap.data() as UserProfile) : null;
      }

      if (!alive) return;
      setChats(
        [...liveChats].sort(
          (a, b) =>
            (b.lastMessageTimestamp?.toMillis?.() || 0) -
            (a.lastMessageTimestamp?.toMillis?.() || 0),
        ),
      );
      setProfiles({ ...profilesRef.current });
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [firestore, liveChats, chatsLoading]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) =>
      chat.participantIds.some((id) => {
        const profile = profiles[id];
        return (
          id.toLowerCase().includes(needle) ||
          (profile?.fullName || '').toLowerCase().includes(needle)
        );
      }),
    );
  }, [chats, profiles, search]);

  const displayName = (id: string) => profiles[id]?.fullName || id.slice(0, 8);
  const roleOf = (id: string) => {
    const profile = profiles[id] as { userRole?: string; role?: string } | null;
    return profile?.userRole || profile?.role || null;
  };

  return (
    <AdminLayout>
      <div className="flex h-full flex-col">
        <div className="shrink-0 space-y-1 border-b border-border/70 px-6 py-4">
          <h1 className="font-headline text-2xl font-bold tracking-tight">
            Seller &amp; Buyer Conversations
          </h1>
          <p className="text-sm text-muted-foreground">
            Every chat on the platform, read-only. Open a conversation to see exactly what each
            side said.
          </p>
        </div>

        {chatsError && (
          <p className="border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-xs font-semibold text-destructive">
            {chatsError}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Conversation list */}
          <div
            className={cn(
              'flex min-h-0 w-full flex-col border-border/70 md:w-96 md:border-r',
              selected ? 'hidden md:flex' : 'flex flex-1',
            )}
          >
            <div className="shrink-0 border-b border-border/50 p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or user id…"
                  aria-label="Search conversations"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <ChatRowSkeleton />
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
                  <MessagesSquare className="h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium">
                    {chats.length === 0 ? 'No conversations yet.' : 'Nothing matches that search.'}
                  </p>
                  <p className="text-xs opacity-70">
                    {chats.length === 0
                      ? 'Chats between sellers and buyers will appear here as soon as they start talking.'
                      : 'Try a user id or a full name.'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((chat) => {
                    const isActive = selected?.id === chat.id;
                    const at = chat.lastMessageTimestamp?.toDate?.() as Date | undefined;
                    return (
                      <li key={chat.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(chat)}
                          className={cn(
                            'w-full rounded-xl border border-transparent p-3 text-left transition-colors',
                            isActive
                              ? 'border-primary/30 bg-primary/10'
                              : 'hover:border-border/60 hover:bg-muted/40',
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex -space-x-2">
                              {chat.participantIds.slice(0, 2).map((id) => (
                                <Avatar key={id} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={profiles[id]?.profilePictureUrl} />
                                  <AvatarFallback className="bg-muted text-[10px] font-bold">
                                    {displayName(id).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {chat.participantIds.map(displayName).join(' ↔ ')}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                {chat.participantIds.slice(0, 2).map((id) => {
                                  const role = roleOf(id);
                                  return role ? (
                                    <Badge
                                      key={id}
                                      variant="outline"
                                      className={cn(
                                        'px-1 py-0 text-[8px] font-bold uppercase',
                                        role === 'seller'
                                          ? 'border-transparent bg-orange-500/15 text-orange-600 dark:text-orange-400'
                                          : 'border-transparent bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
                                      )}
                                    >
                                      {role}
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            </div>
                            {at && (
                              <span className="shrink-0 text-[9px] font-medium text-muted-foreground">
                                {at.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {chat.lastMessage && (
                            <p className="mt-1.5 truncate text-xs text-muted-foreground">
                              {chat.lastMessage}
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Transcript pane */}
          <div
            className={cn(
              'min-h-0 w-full flex-1 flex-col',
              selected ? 'flex' : 'hidden md:flex',
            )}
          >
            {selected ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2 md:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setSelected(null)}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" />
                    All conversations
                  </Button>
                </div>
                <div className="min-h-0 flex-1">
                  <PartyConversation
                    chatId={selected.id}
                    userAId={selected.participantIds[0]}
                    userBId={selected.participantIds[1]}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-muted-foreground">
                <MessagesSquare className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Pick a conversation</p>
                <p className="max-w-xs text-xs opacity-70">
                  Select a seller and buyer on the left to read their full chat history here.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
