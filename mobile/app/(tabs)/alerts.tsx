import React, { useCallback } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import { Button, EmptyState, ErrorState, Loading, Muted, Screen } from '../../src/components/ui';
import { SignedOutPrompt } from '../../src/components/require-auth';
import { notifications } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { messageTime } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';
import type { AppNotification } from '../../src/lib/types';

/**
 * ALERTS — the notification centre.
 *
 * Reads the same notification documents the website header counts. Opening this
 * tab shows the list; the badge is cleared explicitly ("Mark all read") rather
 * than automatically, because silently zeroing a count the moment a screen
 * renders is how people lose track of things they meant to act on.
 *
 * Push delivery is a separate concern: no FCM project is configured for this
 * build, so the app does not pretend to receive pushes. It polls on focus, the
 * same supported method the website uses.
 */
export default function AlertsScreen() {
  const { status } = useAuth();
  if (status === 'signedOut') {
    return (
      <SignedOutPrompt
        title="Alerts need an account"
        body="Sign in to see order updates, offers and messages in one place."
      />
    );
  }
  return <Alerts />;
}

function Alerts() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => notifications.list(token),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const items = (data?.items ?? []) as AppNotification[];
  const unread = Number(data?.unread ?? 0);

  const markAll = async () => {
    try {
      const token = await getToken();
      await notifications.markAllRead(token);
      reload();
    } catch {
      // The list stays as it was; the user can try again.
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Loading alerts…" />
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
        data={items}
        keyExtractor={(item, index) => item.id ?? `alert-${index}`}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          unread > 0 ? (
            <View style={styles.header}>
              <Muted>
                {unread} unread {unread === 1 ? 'alert' : 'alerts'}
              </Muted>
              <Pressable onPress={markAll} hitSlop={8} accessibilityRole="button">
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View style={[styles.row, !item.isRead && styles.rowUnread]}>
            <View style={styles.icon}>
              <Ionicons name={iconFor(item.type)} size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.title, !item.isRead && styles.titleUnread]}>
                {item.title || 'Vidnov'}
              </Text>
              {item.message ? (
                <Text numberOfLines={3} style={styles.body}>
                  {item.message}
                </Text>
              ) : null}
              <Muted>{messageTime(item.createdAt)}</Muted>
            </View>
            {!item.isRead ? <View style={styles.dot} /> : null}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="You're all caught up"
            body="Order updates, offers and new messages will show up here."
            action={
              <Button label="Browse Vidnov" variant="outline" onPress={() => router.push('/(tabs)/discover')} />
            }
          />
        }
      />
    </Screen>
  );
}

function iconFor(type?: string): keyof typeof Ionicons.glyphMap {
  switch ((type || '').toLowerCase()) {
    case 'order':
    case 'order_update':
      return 'receipt-outline';
    case 'message':
    case 'chat':
      return 'chatbubble-outline';
    case 'offer':
      return 'pricetag-outline';
    case 'review':
      return 'star-outline';
    case 'payment':
    case 'wallet':
      return 'wallet-outline';
    case 'live':
      return 'radio-outline';
    case 'follow':
      return 'person-add-outline';
    default:
      return 'notifications-outline';
  }
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  markAll: { color: colors.primary, ...type.caption, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowUnread: { borderColor: 'rgba(255, 77, 46, 0.35)' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, ...type.body },
  titleUnread: { fontWeight: '700' },
  body: { color: colors.textMuted, ...type.caption, lineHeight: 17 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
});
