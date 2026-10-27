'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { fetchChats } from '@/lib/chat/client';
import { useMessages } from '@/lib/chat/use-chat';
import type { ChatMessage, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Loader2, MessageSquareOff } from 'lucide-react';

/**
 * ADMIN · SELLER↔BUYER CONVERSATION (read-only).
 *
 * The moderation consoles could always read `chats` — the rules have allowed
 * admins since the collection existed — but nothing rendered the thread, so an
 * admin mediating a seller/buyer dispute had to ask both parties what they said.
 * This component is the missing view: given the two participants, it finds
 * their chat document, subscribes to the messages, and renders the transcript
 * with each side labelled and badged by role.
 *
 * Deliberately read-only: an admin typing into a private conversation would
 * appear in the thread as a third party mid-argument. Moderation reads;
 * participation happens through support tickets.
 *
 * Chat lookup is one admin-scoped read of the VPS conversation list (the pair
 * is matched client-side), then the thread itself comes from the same
 * `/api/chat/{id}/messages` route the app uses — an admin's verified token is
 * allowed to read any thread, a participant's only their own. The route caps
 * a thread at its newest messages, so a very old, very busy conversation
 * cannot stall the dialog that embeds this.
 */

interface Party {
  id: string;
  profile: UserProfile | null;
}

export interface PartyConversationProps {
  /** Either pass a known chat id (the conversations console has one), or… */
  chatId?: string;
  /** …the two participants, and the chat between them is looked up. */
  userAId?: string | null;
  userBId?: string | null;
  className?: string;
}

function roleOf(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const raw = (profile as { userRole?: string; role?: string }).userRole
    ?? (profile as { role?: string }).role
    ?? null;
  return raw || null;
}

function roleBadgeClass(role: string | null): string {
  if (role === 'seller') return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-transparent';
  if (role === 'buyer') return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-transparent';
  return 'bg-muted text-muted-foreground border-transparent';
}

/** Human label for the message body, which lives in different fields per era. */
function bodyOf(message: ChatMessage): string {
  return message.messageText ?? message.text ?? '';
}

/** One bubble. Media types render a chip rather than pretending to be text. */
function Bubble({
  message,
  side,
  party,
}: {
  message: ChatMessage;
  side: 'left' | 'right';
  party: Party | undefined;
}) {
  const text = bodyOf(message);
  const isImage = message.messageType === 'image' && /^https?:\/\//.test(message.mediaUrl ?? '');
  const isVoice = message.messageType === 'voice';
  const isProduct = message.messageType === 'product';
  const isOrder = message.messageType === 'order';
  const at = message.timestamp?.toDate?.() as Date | undefined;

  return (
    <div className={cn('flex w-full gap-2', side === 'right' && 'flex-row-reverse')}>
      <Avatar className="h-7 w-7 shrink-0 border border-border/70">
        <AvatarImage src={party?.profile?.profilePictureUrl} />
        <AvatarFallback className="bg-muted text-[10px] font-bold">
          {(party?.profile?.fullName || party?.id || '?').charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className={cn('min-w-0 max-w-[78%]', side === 'right' && 'text-right')}>
        <p className="mb-0.5 truncate text-[10px] font-semibold text-muted-foreground">
          {party?.profile?.fullName || party?.id?.slice(0, 8) || 'Unknown user'}
        </p>
        <div
          className={cn(
            'inline-block rounded-2xl px-3 py-2 text-left text-sm',
            side === 'left'
              ? 'rounded-tl-sm bg-muted/70'
              : 'rounded-tr-sm bg-primary/15',
          )}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- chat media is
            // user-uploaded and served from storage; a plain img is the same
            // rendering the chat surfaces themselves use.
            <img
              src={message.mediaUrl}
              alt={text || 'Shared image'}
              className="max-h-48 max-w-full rounded-lg object-cover"
            />
          ) : isVoice ? (
            <span className="text-xs italic opacity-80">🎤 Voice note</span>
          ) : isProduct ? (
            <span className="text-xs italic opacity-80">🛍 Shared a product{text ? ` — ${text}` : ''}</span>
          ) : isOrder ? (
            <span className="text-xs italic opacity-80">📦 Shared an order{text ? ` — ${text}` : ''}</span>
          ) : (
            <p className="whitespace-pre-wrap break-words">{text || '…'}</p>
          )}
        </div>
        {at && (
          <p className="mt-0.5 text-[9px] text-muted-foreground/70">
            {at.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

export function PartyConversation({
  chatId: chatIdProp,
  userAId,
  userBId,
  className,
}: PartyConversationProps) {
  const firestore = useFirestore();
  const { user } = useUser();

  const [chatId, setChatId] = React.useState<string | null>(chatIdProp ?? null);
  const [isFindingChat, setIsFindingChat] = React.useState(
    !chatIdProp && !!userAId && !!userBId && userAId !== userBId,
  );
  const [parties, setParties] = React.useState<Record<string, Party>>({});
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const {
    messages: liveMessages,
    error: readError,
  } = useMessages(chatId);
  // `null` means "not loaded yet" to the renderer below; once a thread is
  // selected the hook always has an array (possibly empty).
  const messages = chatId === null ? null : liveMessages;

  // Explicit chat id wins; otherwise find the one chat containing both uids.
  React.useEffect(() => {
    if (chatIdProp) {
      setChatId(chatIdProp);
      setIsFindingChat(false);
      return;
    }
    if (!user || !userAId || !userBId || userAId === userBId) {
      setChatId(null);
      setIsFindingChat(false);
      return;
    }

    setIsFindingChat(true);
    // Admin scope: every conversation, read once and matched on the pair.
    fetchChats(user, 'all')
      .then((chats) => {
        const match = chats.find(
          (chat) => chat.participantIds.includes(userAId) && chat.participantIds.includes(userBId),
        );
        setChatId(match?.id ?? null);
        setIsFindingChat(false);
      })
      .catch(() => {
        // A denied read or a storage outage must read as "no thread found",
        // not as a spinner that never resolves.
        setChatId(null);
        setIsFindingChat(false);
      });
  }, [user, chatIdProp, userAId, userBId]);

  // Profiles are public `get()` reads, fetched once per participant and cached
  // for the life of the panel — the same shape the seller inbox uses, because
  // `list` on userProfiles is restricted even for the parties themselves.
  React.useEffect(() => {
    if (!firestore) return;
    const ids = Array.from(
      new Set([userAId, userBId].filter((id): id is string => !!id)),
    );
    let cancelled = false;
    void (async () => {
      for (const id of ids) {
        if (parties[id] !== undefined) continue;
        const snap = await getDoc(doc(firestore, 'userProfiles', id)).catch(() => null);
        const profile = snap?.exists() ? (snap.data() as UserProfile) : null;
        if (cancelled) return;
        setParties((prev) => ({ ...prev, [id]: { id, profile } }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // `parties` is intentionally read through the ref-style guard above rather
    // than as a dependency: re-running per cached id would refetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, userAId, userBId]);

  // Pin to the newest message as the transcript streams in.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const participantIds = React.useMemo(() => {
    if (userAId && userBId) return [userAId, userBId];
    return Object.keys(parties);
  }, [userAId, userBId, parties]);

  const isEmpty = !isFindingChat && chatId !== null && messages !== null && messages.length === 0;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* Header: who is in this conversation. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-3 py-2">
        {participantIds.length === 0 ? (
          <span className="text-xs text-muted-foreground">Select a conversation</span>
        ) : (
          participantIds.map((id) => {
            const party = parties[id];
            const role = roleOf(party?.profile ?? null);
            return (
              <span key={id} className="flex items-center gap-1.5">
                <span className="max-w-[10rem] truncate text-xs font-semibold">
                  {party?.profile?.fullName || (party === undefined ? '…' : id.slice(0, 8))}
                </span>
                {role && (
                  <Badge variant="outline" className={cn('text-[9px] font-bold uppercase', roleBadgeClass(role))}>
                    {role}
                  </Badge>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {isFindingChat ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-xs">Finding the conversation…</p>
          </div>
        ) : !chatId ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <MessageSquareOff className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No conversation between these two users yet.</p>
            <p className="text-xs opacity-70">
              When either side starts a chat, the full transcript will appear here.
            </p>
          </div>
        ) : readError ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm font-medium text-destructive">{readError}</p>
            <p className="text-xs text-muted-foreground">Try again in a moment.</p>
          </div>
        ) : messages === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p className="text-xs">Loading messages…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-muted-foreground">
            <p className="text-sm font-medium">This chat is empty.</p>
            <p className="text-xs opacity-70">The conversation was opened, but no message was ever sent.</p>
          </div>
        ) : (
          messages.map((message) => {
            const side = message.senderId === userAId ? 'left' : 'right';
            return (
              <Bubble
                key={message.id}
                message={message}
                side={side}
                party={parties[message.senderId]}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
