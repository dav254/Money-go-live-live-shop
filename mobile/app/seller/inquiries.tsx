import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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
import { RequireAuth } from '../../src/components/require-auth';
import { messaging } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { messageTime } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * BUYER INQUIRIES — the real conversations a shop receives.
 *
 * `/api/mobile/chats` already resolves the other participant server-side, so
 * this list is the same inbox the buyer sees, from the seller's side. Opening a
 * row goes to the shared native chat screen; nothing here fabricates an inquiry
 * or a reply.
 */
export default function SellerInquiriesScreen() {
  return (
    <RequireAuth>
      <Inquiries />
    </RequireAuth>
  );
}

function Inquiries() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => messaging.threads(token), []);

  const chats = Array.isArray(data?.chats) ? data!.chats : [];
  const unreadFor = (chat: any): number =>
    Number(chat?.unreadCounts?.[String(session?.uid ?? '')] ?? 0);

  return (
    <Screen>
      <SellerHeader title="Buyer inquiries" subtitle={`${chats.length} conversations`} showBack />
      {loading && !data ? (
        <Loading label="Loading conversations…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(chat) => String(chat.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={reload}
          renderItem={({ item }) => {
            const unread = unreadFor(item);
            const other = item.otherParticipant ?? {};
            const name = other.shopName || other.fullName || 'Vidnov buyer';
            return (
              <Pressable
                onPress={() => router.push(`/chat/${item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${name}`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              >
                <Avatar uri={other.profilePictureUrl} name={name} size={46} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.nameRow}>
                    <Text numberOfLines={1} style={styles.name}>
                      {name}
                    </Text>
                    <Muted>
                      {messageTime(
                        typeof item.lastMessageTimestamp === 'string'
                          ? item.lastMessageTimestamp
                          : null,
                      )}
                    </Muted>
                  </View>
                  <Text numberOfLines={2} style={styles.preview}>
                    {item.lastMessage || 'No messages yet — say hello.'}
                  </Text>
                </View>
                {unread > 0 ? <Badge label={String(unread)} tone="primary" /> : (
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No inquiries yet"
              body="When a buyer messages your shop about a product or service, the conversation appears here."
            />
          }
        />
      )}
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { color: colors.text, ...type.bodyStrong, flex: 1 },
  preview: { color: colors.textFaint, ...type.caption, lineHeight: 17 },
});
