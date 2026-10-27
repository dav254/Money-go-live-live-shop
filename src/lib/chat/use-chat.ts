'use client';

/**
 * CHAT HOOKS — live inbox and thread over polling.
 *
 * The message section used to subscribe to Firestore with `onSnapshot`; every
 * read and write now goes through the VPS-owned `/api/chat` routes, and these
 * hooks provide the liveness that the listener used to give:
 *
 *  - an interval (thread faster than inbox — a conversation is where you are
 *    looking),
 *  - an immediate refresh when the tab regains focus or becomes visible (a
 *    phone returning from the lock screen catches up at once),
 *  - an in-flight guard so a slow response can never stack up requests.
 *
 * Nothing here decides whose messages are being read: the API derives the uid
 * from the verified ID token. A failure sets `error` instead of throwing, so a
 * storage problem renders as a message in the panel rather than a blank screen
 * or an unhandled rejection in a render path.
 */

import * as React from 'react';
import { useUser } from '@/firebase';
import type { Chat, ChatMessage } from '@/lib/types';
import { ChatApiError, fetchChats, fetchMessages } from './client';

const INBOX_POLL_MS = 8_000;
const THREAD_POLL_MS = 4_000;

function useRefreshLoop(
  run: () => Promise<void>,
  pollMs: number,
  enabled: boolean,
): () => void {
  const runRef = React.useRef(run);
  runRef.current = run;
  const inFlight = React.useRef(false);

  const safeRun = React.useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    try {
      await runRef.current();
    } finally {
      inFlight.current = false;
    }
  }, [enabled]);

  const refresh = React.useCallback(() => {
    void safeRun();
  }, [safeRun]);

  React.useEffect(() => {
    if (!enabled) return;
    void safeRun();
    const id = setInterval(() => void safeRun(), pollMs);
    const onFocus = () => void safeRun();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void safeRun();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [safeRun, pollMs, enabled]);

  return refresh;
}

export interface UseChatsResult {
  chats: Chat[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * The signed-in user's conversations, newest first. `scope: 'all'` is the
 * admin console's view of every conversation and is rejected by the API for
 * anyone else.
 */
export function useChats(options: { scope?: 'mine' | 'all'; pollMs?: number } = {}): UseChatsResult {
  const scope = options.scope ?? 'mine';
  const pollMs = options.pollMs ?? INBOX_POLL_MS;
  const { user } = useUser();

  const [chats, setChats] = React.useState<Chat[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Same staleness guard as the thread hook: a reply that belongs to a
  // previous session or scope must never populate the current inbox.
  const keyRef = React.useRef(`${user?.uid ?? ''}|${scope}`);
  React.useEffect(() => {
    keyRef.current = `${user?.uid ?? ''}|${scope}`;
  }, [user?.uid, scope]);

  const run = React.useCallback(async () => {
    if (!user) {
      setChats([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    const key = `${user.uid}|${scope}`;
    try {
      const rows = await fetchChats(user, scope);
      if (keyRef.current !== key) return; // stale session or scope
      setChats(rows);
      setError(null);
    } catch (err) {
      if (keyRef.current !== key) return;
      // Keep whatever is on screen; surface the reason (503 names the missing
      // storage configuration) so the panel explains itself.
      setError(err instanceof ChatApiError ? err.message : 'Could not load conversations.');
    } finally {
      if (keyRef.current === key) setIsLoading(false);
    }
  }, [user, scope]);

  const refresh = useRefreshLoop(run, pollMs, !!user);
  return { chats, isLoading, error, refresh };
}

export interface UseMessagesResult {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** One conversation's messages, oldest → newest. Pauses while `chatId` is null. */
export function useMessages(
  chatId: string | null | undefined,
  options: { pollMs?: number } = {},
): UseMessagesResult {
  const pollMs = options.pollMs ?? THREAD_POLL_MS;
  const { user } = useUser();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /*
   * Identifies "who / which thread" a response belongs to. A reply that
   * arrives after the user has switched conversations must never land in the
   * newly opened one — the screen would show somebody else's messages for a
   * moment, which is the worst possible failure for a chat.
   */
  const keyRef = React.useRef(`${user?.uid ?? ''}|${chatId ?? ''}`);
  React.useEffect(() => {
    keyRef.current = `${user?.uid ?? ''}|${chatId ?? ''}`;
  }, [user?.uid, chatId]);

  const run = React.useCallback(async () => {
    if (!user || !chatId) {
      setMessages([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    const key = `${user.uid}|${chatId}`;
    try {
      const rows = await fetchMessages(user, chatId);
      if (keyRef.current !== key) return; // stale — a newer thread is open now
      setMessages(rows);
      setError(null);
    } catch (err) {
      if (keyRef.current !== key) return;
      setError(err instanceof ChatApiError ? err.message : 'Could not load messages.');
    } finally {
      if (keyRef.current === key) setIsLoading(false);
    }
  }, [user, chatId]);

  // Switching threads must never show the previous conversation's messages.
  React.useEffect(() => {
    setMessages([]);
    setIsLoading(true);
  }, [chatId]);

  const refresh = useRefreshLoop(run, pollMs, !!user && !!chatId);
  return { messages, isLoading, error, refresh };
}
