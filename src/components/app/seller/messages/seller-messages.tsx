'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { useChats } from '@/lib/chat/use-chat';
import { SellerConversationList, type Conversation } from './conversation-list';
import { SellerThread } from './thread';
import { cn } from '@/lib/utils';

/**
 * SELLER APP · MESSAGES.
 *
 * ## Why this section was rewritten rather than reused
 *
 * The screen used to mount the website's `ChatSystem` inside the seller shell.
 * That looked like the app while it was the website: the website's two-pane
 * desktop layout, the website's search box (which was not wired to anything),
 * and — in a chat bubble — a "PAY NOW" button telling a seller to pay their
 * own invoice.
 *
 * This is the app's own implementation. Same feature set, but written for
 * one-handed use in this shell: a full-screen list that pushes into a
 * full-screen thread and comes back, which is how a phone actually works.
 *
 * ## Read rules
 *
 * Conversations come from the VPS store (`useChats` → `/api/chat`, polled) —
 * this screen no longer issues a Firestore query on `chats` at all. The API
 * scopes every row to the caller's own uid from their verified token.
 *
 * Participant profiles are still read from `userProfiles`, one `getDoc` per
 * id: `firestore.rules` allows anyone to `get` a profile but restricts `list`
 * to self, referrer or admin, so a batched `in` query is denied the moment a
 * seller reads a buyer's profile. That rejection used to be uncaught inside an
 * `onSnapshot` callback, which aborted it and left the seller with an empty
 * inbox that looked exactly like "the buyer never messaged me". `get` is
 * public, so this is the only shape that works, and a rejected read can no
 * longer take the inbox down with it.
 *
 * Both `participantIds` and `deletedFor` are normalised before use: older chat
 * records omit them, and reading them unguarded is what crashed the screen.
 */
export function SellerMessages() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const profilesRef = React.useRef(new Map<string, UserProfile>());
  // Profiles live in a ref (they change far less often than chats), so the
  // list needs a nudge when a batch lands.
  const [profileVersion, setProfileVersion] = React.useState(0);

  const {
    chats: liveChats,
    isLoading: chatsLoading,
    error: chatsError,
    refresh: refreshChats,
  } = useChats();

  const chatWith = searchParams?.get('chatWith');

  React.useEffect(() => {
    if (!firestore || !user || chatsLoading) return;
    let alive = true;

    const wanted = new Set<string>();
    liveChats.forEach((chat) => {
      chat.participantIds.forEach((id) => {
        if (id !== user.uid && !profilesRef.current.has(id)) wanted.add(id);
      });
    });
    if (wanted.size === 0) {
      setIsLoading(false);
      return;
    }

    (async () => {
      for (const id of wanted) {
        const profileSnap = await getDoc(doc(firestore, 'userProfiles', id)).catch(
          () => null,
        );
        const profile = profileSnap?.exists() ? (profileSnap.data() as UserProfile) : null;
        // Cache even a miss, so a profile that will never resolve is not
        // re-fetched on every poll.
        profilesRef.current.set(id, profile ?? ({ id } as UserProfile));
      }
      if (!alive) return;
      setProfileVersion((v) => v + 1);
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [firestore, user, liveChats, chatsLoading]);

  const chats = React.useMemo<Conversation[]>(() => {
    if (!user) return [];
    return liveChats
      .filter((chat) => !(chat.deletedFor ?? []).includes(user.uid))
      .map((chat) => {
        const otherId = chat.participantIds.find((id) => id !== user.uid);
        return {
          ...chat,
          otherParticipant: otherId ? profilesRef.current.get(otherId) : undefined,
          unreadCount: chat.unreadCounts?.[user.uid] ?? 0,
        } satisfies Conversation;
      })
      .sort(
        (a, b) =>
          (b.lastMessageTimestamp?.toMillis?.() ?? 0) -
          (a.lastMessageTimestamp?.toMillis?.() ?? 0),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveChats, user, profileVersion, isLoading]);

  /**
   * Deep link support: `/app/seller/messages?chatWith=<uid>` (used by Requests,
   * Orders and the storefront) opens that conversation directly — once its
   * participants have resolved, since a chat cannot be identified without
   * knowing who is in it.
   */
  React.useEffect(() => {
    if (!chatWith || selectedId || chats.length === 0) return;
    const match = chats.find((c) => c.participantIds.includes(chatWith));
    if (match) setSelectedId(match.id);
  }, [chatWith, chats, selectedId]);

  const selected = chats.find((c) => c.id === selectedId) ?? null;
  const other = selected?.otherParticipant ?? undefined;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {/* List — full screen until a conversation opens. */}
      <div
        className={cn(
          'min-h-0 min-w-0 w-full transition-transform duration-200 md:w-80 md:shrink-0',
          selected ? 'hidden md:block' : 'block',
        )}
      >
        {chatsError && (
          <p className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-destructive">
            {chatsError}
          </p>
        )}
        <SellerConversationList
          conversations={chats}
          selectedId={selectedId}
          onSelect={(chat) => setSelectedId(chat.id)}
          isLoading={isLoading}
        />
      </div>

      {/* Thread — takes over the screen on a phone, side by side on desktop.

          `min-w-0` is the fix for the thread spilling past the card edge: a flex
          child defaults to `min-width: auto`, so the moment any row inside it
          (a long word, a wide attachment card) is wider than half the viewport,
          the whole column grows past its parent and the right-hand side —
          timestamps, the send button — gets clipped instead of wrapping. */}
      <div
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-hidden transition-transform duration-200',
          selected ? 'block' : 'hidden md:block',
        )}
      >
        {selected ? (
          <SellerThread
            chat={selected}
            currentUser={user!}
            other={other}
            onBack={() => setSelectedId(null)}
            onDeleted={() => {
              // Back out of the thread at once, then re-read the inbox so the
              // row leaves now instead of at the next poll tick.
              setSelectedId(null);
              refreshChats();
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="font-grotesk text-sm font-semibold text-foreground">
              Pick a conversation
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Answering fast is what turns a question into a sale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
