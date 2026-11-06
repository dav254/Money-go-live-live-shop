import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';

import { EmptyState, Loading, Muted, Screen } from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { messageFor, messaging } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { clientMessageId, messageTime } from '../../src/lib/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { ChatMessage } from '../../src/lib/types';

const POLL_MS = 4_000;

/**
 * CHAT THREAD.
 *
 * Native composer, native message list, polling for new messages — the same
 * supported update method the website uses (no Firestore listener, no socket
 * server to keep alive on a phone).
 *
 * The route accepts two ids:
 *   - an existing chat id, opened from the inbox;
 *   - `new:<sellerId>`, opened from "Message seller" on a listing or shop. The
 *     server's `POST /api/chat` is idempotent, so re-opening an existing
 *     conversation returns the same thread instead of creating a duplicate.
 */
export default function ChatScreen() {
  return (
    <RequireAuth>
      <Thread />
    </RequireAuth>
  );
}

function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { getToken, profile } = useAuth();

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const raw = String(id ?? '');

  // Resolve the target conversation once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!raw.startsWith('new:')) {
          if (alive) setChatId(raw);
          return;
        }
        const token = await getToken();
        const opened = await messaging.open(token, raw.slice(4));
        const resolved = opened.chat?.id ?? opened.chatId ?? opened.id ?? null;
        if (!resolved) throw new Error('Could not open that conversation.');
        if (alive) setChatId(String(resolved));
      } catch (thrown) {
        if (alive) setError(messageFor(thrown));
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken, raw]);

  // Poll the thread while this screen is mounted.
  useEffect(() => {
    if (!chatId) return;
    let alive = true;

    const load = async (initial: boolean) => {
      try {
        const token = await getToken();
        const result = await messaging.messages(token, chatId);
        if (!alive) return;
        setMessages((result.messages ?? []) as ChatMessage[]);
        setError(null);
        if (initial) setLoading(false);
      } catch (thrown) {
        if (!alive) return;
        if (initial) {
          setError(messageFor(thrown));
          setLoading(false);
        }
        // A failed poll keeps the messages already on screen.
      }
    };

    load(true);
    const timer = setInterval(() => load(false), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [chatId, getToken]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !chatId || sending) return;

    setSending(true);
    setSendError(null);
    const optimistic: ChatMessage = {
      id: `local-${clientMessageId()}`,
      senderId: profile?.id ?? profile?.uid ?? 'me',
      messageText: text,
      messageType: 'text',
      timestamp: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setDraft('');

    try {
      const token = await getToken();
      await messaging.send(token, chatId, {
        clientMsgId: clientMessageId(),
        messageType: 'text',
        messageText: text,
      });
      const refreshed = await messaging.messages(token, chatId);
      setMessages((refreshed.messages ?? []) as ChatMessage[]);
    } catch (thrown) {
      // The message did not reach the server: drop the optimistic bubble and
      // put the text back in the composer so nothing is silently lost.
      setMessages((current) => current.filter((m) => m.id !== optimistic.id));
      setDraft(text);
      setSendError(messageFor(thrown));
    } finally {
      setSending(false);
    }
  }, [chatId, draft, getToken, profile?.id, profile?.uid, sending]);

  // Keep the newest message visible as the thread grows.
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const myId = profile?.id ?? profile?.uid ?? '';

  if (loading && !chatId) return <Loading label="Opening conversation…" />;

  if (error) {
    return (
      <Screen>
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="That conversation didn't open"
          body={error}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={navigation ? 96 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, index) => item.id ?? `msg-${index}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = item.senderId === myId;
          const text = item.messageText || item.text || '';
          return (
            <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : null]}>
                <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{text}</Text>
                <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : null]}>
                  {messageTime(typeof item.timestamp === 'string' ? item.timestamp : null)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <Loading label="Loading messages…" />
          ) : (
            <View style={styles.empty}>
              <Muted>No messages yet. Say hello.</Muted>
            </View>
          )
        }
      />

      {sendError ? (
        <Pressable onPress={() => setSendError(null)} style={styles.sendError}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={styles.sendErrorText}>{sendError}</Text>
        </Pressable>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[styles.send, (!draft.trim() || sending) && { opacity: 0.45 }]}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 3,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: 4,
  },
  bubbleText: { color: colors.text, ...type.body, lineHeight: 21 },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { color: colors.textFaint, fontSize: 10.5, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  sendError: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
  },
  sendErrorText: { color: colors.danger, ...type.caption, flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
