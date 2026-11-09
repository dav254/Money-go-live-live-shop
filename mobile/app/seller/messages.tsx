import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { RequireAuth } from '../../src/components/require-auth';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
} from '../../src/components/ui';
import { messaging } from '../../src/lib/api';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER MESSAGES — the seller's side of the same chat collection the buyer
 * inbox reads (`GET /api/mobile/chats`, which joins the other participant).
 *
 * It exists as its own route because the seller drawer and `/app/seller` both
 * list Messages inside the seller section; sending a shop owner to the buyer's
 * tab would move them out of their own workspace mid-task.
 *
 * No polling interval of its own: the thread screen does the polling, and this
 * list refreshes on focus.
 */
export default function SellerMessagesScreen() {
  return (
    <RequireAuth>
      <Inbox />
    </RequireAuth>
  );
}

function Inbox() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => messaging.threads(token),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const chats = (data?.chats ?? []) as any[];
  const unread = chats.reduce((sum, chat) => sum + (Number(chat.unread) || 0), 0);

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="Messages" showBack />
        <Loading label="Loading conversations…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="Messages" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader
        title="Messages"
        subtitle={unread > 0 ? `${unread} unread` : 'Conversations with buyers'}
        showBack
      />
      <FlatList
        data={chats}
        keyExtractor={(chat) => String(chat.id)}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => {
          const other = item.other ?? null;
          const count = Number(item.unread) || 0;
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation with ${other?.shopName || other?.name || 'a Vidnov member'}`}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceRaised }]}
            >
              <Avatar uri={other?.avatarUrl} name={other?.shopName || other?.name} size={44} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {other?.shopName || other?.name || 'Vidnov member'}
                </Text>
                <Muted numberOfLines={1} style={styles.preview}>
                  {item.lastMessage || 'No messages yet'}
                </Muted>
              </View>
              {count > 0 ? <Badge label={count > 9 ? '9+' : String(count)} tone="primary" /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations yet"
            body="When a buyer messages your shop, the thread appears here and in the buyer's inbox."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  name: { color: colors.text, ...type.bodyStrong },
  preview: { fontSize: 12 },
});
