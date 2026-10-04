'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  collection, getDocs, onSnapshot, query, where,
} from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Chat, UserProfile } from '@/lib/types';
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
 * This is the app's own implementation. Same Firestore documents, same write
 * contract, same feature set, but written for one-handed use in this shell:
 * a full-screen list that pushes into a full-screen thread and comes back,
 * which is how a phone actually works.
 *
 * ## Read rules
 *
 * `firestore.rules` permits only `chats` filtered by
 * `participantIds array-contains uid`, so that is the only query issued here —
 * never a bare `list()`. Participants are fetched in batches of 30 because
 * `in` queries are capped at 30 values.
 *
 * Both `participantIds` and `deletedFor` are normalised at the point documents
 * enter state. Older chat documents, and any created outside the app, omit
 * them; reading them unguarded threw inside `onSnapshot`, which crashed the
 * whole screen once real data arrived — after a perfect server render.
 */
export function SellerMessages() {
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [chats, setChats] = React.useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const profilesRef = React.useRef(new Map<string, UserProfile>());

  const chatWith = searchParams?.get('chatWith');

  React.useEffect(() => {
    if (!firestore || !user) return;
    let alive = true;
    setIsLoading(true);

    const chatsQuery = query(
      collection(firestore, 'chats'),
      where('participantIds', 'array-contains', user.uid),
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const normalised: Chat[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
            deletedFor: Array.isArray(data.deletedFor) ? data.deletedFor : [],
          } as Chat;
        });

        // Profiles change far less often than chats, so they are cached for the
        // life of the screen and only fetched for ids not already known.
        const wanted = new Set<string>();
        normalised.forEach((chat) => {
          chat.participantIds.forEach((id) => {
            if (id !== user.uid && !profilesRef.current.has(id)) wanted.add(id);
          });
        });

        if (wanted.size > 0) {
          const ids = Array.from(wanted);
          for (let i = 0; i < ids.length; i += 30) {
            const chunk = ids.slice(i, i + 30);
            const part = await getDocs(
              query(collection(firestore, 'userProfiles'), where('id', 'in', chunk)),
            );
            part.docs.forEach((d) => {
              const profile = d.data() as UserProfile;
              profilesRef.current.set(profile.id ?? d.id, profile);
            });
          }
        }

        if (!alive) return;

        setChats(
          normalised
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
            ),
        );
        setIsLoading(false);
      },
      () => {
        if (alive) setIsLoading(false);
      },
    );

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [firestore, user]);

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
              // Drop it locally first so the row disappears immediately, then
              // let the snapshot catch up. Waiting on the write made the delete
              // feel broken on a slow connection.
              setChats((prev) => prev.filter((c) => c.id !== selected.id));
              setSelectedId(null);
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