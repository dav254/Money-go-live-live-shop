import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { live, messageFor } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colors, radius, spacing, type } from '../../theme';

type ChatMessage = { id?: string; message: string; senderName?: string; uid?: string };

/**
 * LIVE CHAT — the real comment stream of one live session.
 *
 * It polls `GET /api/live/[id]/chat` (the same endpoint the website reads)
 * rather than opening a second realtime channel, because the app has no
 * Firestore listener and a socket would be a second transport for the same
 * data. Polling every four seconds is enough for a shop stream and costs one
 * small request.
 *
 * Signed-out viewers can watch but not post: `POST` needs a bearer token, and
 * the composer says so instead of failing under their thumb.
 */
export function LiveChat({
  sessionId,
  compact = false,
}: {
  sessionId: string;
  compact?: boolean;
}) {
  const { status, getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const load = useCallback(async () => {
    if (status !== 'signedIn') return;
    try {
      const token = await getToken();
      const result = await live.chat(token, sessionId);
      setMessages(Array.isArray(result?.messages) ? result.messages : []);
    } catch {
      // A dropped poll is not worth a banner; the next one usually lands.
    }
  }, [getToken, sessionId, status]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [load, status]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      await live.sendChat(token, sessionId, text);
      setDraft('');
      await load();
      scroller.current?.scrollToEnd({ animated: true });
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <ScrollView
        ref={scroller}
        style={styles.list}
        contentContainerStyle={{ gap: spacing.xs, padding: spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <Text style={styles.empty}>
            {status === 'signedIn' ? 'No comments yet. Say hello.' : 'Sign in to read and post comments.'}
          </Text>
        ) : (
          messages.map((entry, index) => (
            <Text key={entry.id ?? `${index}`} style={styles.line}>
              <Text style={styles.author}>{entry.senderName || 'Viewer'}</Text>
              <Text> {entry.message}</Text>
            </Text>
          ))
        )}
      </ScrollView>

      {status === 'signedIn' ? (
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about the product…"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            editable={!sending}
            maxLength={300}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => void send()}
            disabled={sending || draft.trim().length === 0}
            accessibilityRole="button"
            accessibilityLabel="Send comment"
            style={({ pressed }) => [
              styles.send,
              (sending || draft.trim().length === 0) && { opacity: 0.5 },
              pressed && { opacity: 0.8 },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="arrow-up" size={18} color={colors.white} />
            )}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(16,16,16,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  wrapCompact: { maxHeight: 260 },
  list: { maxHeight: 180 },
  empty: { ...type.caption, color: colors.textFaint, padding: spacing.xs },
  line: { ...type.caption, color: colors.text },
  author: { fontWeight: '700', color: colors.text },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...type.body,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...type.caption, color: colors.primary, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
});
