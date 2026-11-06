import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Avatar, Button, EmptyState, ErrorState, Loading, Muted, Screen } from '../../src/components/ui';
import { SignedOutPrompt } from '../../src/components/require-auth';
import { messaging } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { messageTime, preview } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * MESSAGES — the inbox.
 *
 * Conversations are stored on the Vidnov server (PocketBase-backed chat store),
 * not in a third-party messaging product, so the app and the website open the
 * same threads. The list refreshes when the tab regains focus and on pull, which
 * is the same polling model the website uses — no Firestore listener required.
 */
export default function MessagesScreen() {
  const { status } = useAuth();
  if (status === 'signedOut') {
    return (
      <SignedOutPrompt
        title="Your messages live here"
        body="Sign in to see conversations with buyers and sellers — the same threads you see on vidnov.com."
      />
    );
  }
  return <Inbox />;
}

function Inbox() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => messaging.threads(token),
    [],
  );

  // Refresh on focus: coming back from a thread should show the new message.
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const chats = (data?.chats ?? []) as any[];

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Loading conversations…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={chats}
        keyExtractor={(chat) => chat.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => {
          const other = item.other ?? null;
          const unread = Number(item.unread ?? 0);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Conversation with ${other?.shopName || other?.name || 'a Vidnov member'}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              <Avatar uri={other?.avatarUrl} name={other?.shopName || other?.name} size={46} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.rowTop}>
                  <Text numberOfLines={1} style={styles.name}>
                    {other?.shopName || other?.name || 'Vidnov member'}
                  </Text>
                  <Text style={styles.time}>{messageTime(item.lastMessageAt)}</Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text numberOfLines={1} style={[styles.preview, unread > 0 && styles.previewUnread]}>
                    {preview(item.lastMessage, 60) || 'No messages yet'}
                  </Text>
                  {unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations yet"
            body="Tap “Message seller” on any listing, or reply to a buyer from your seller orders."
            action={
              <Button
                label="Browse listings"
                variant="outline"
                onPress={() => router.push('/(tabs)/discover')}
              />
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { color: colors.text, ...type.bodyStrong, flex: 1 },
  time: { color: colors.textFaint, fontSize: 11.5 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: { color: colors.textMuted, ...type.caption, flex: 1 },
  previewUnread: { color: colors.text, fontWeight: '600' },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
