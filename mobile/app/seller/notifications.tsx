import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RequireAuth } from '../../src/components/require-auth';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
} from '../../src/components/ui';
import { messageFor, notifications } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useAuthedResource } from '../../src/lib/use-authed';
import { shortDate } from '../../src/lib/format';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER NOTIFICATIONS — the same notification documents the buyer alerts tab
 * shows, listed inside the seller section.
 *
 * The distinction that matters: this is the history (what happened), while
 * Settings holds the toggles (what should reach the phone). The website splits
 * them the same way, and merging them was what made "turn this off" look like
 * "delete this message".
 *
 * Reading marks nothing. "Mark all read" calls the server route; if it fails the
 * screen says so instead of clearing the dots optimistically.
 */
type Item = {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  isRead?: boolean;
  createdAt?: string;
  type?: string;
};

export default function SellerNotificationsScreen() {
  return (
    <RequireAuth>
      <Inbox />
    </RequireAuth>
  );
}

function Inbox() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => notifications.list(token),
    [],
  );
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const items = ((data?.items ?? []) as Item[]).slice().sort((a, b) => {
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return right - left;
  });
  const unread = Number(data?.unread ?? 0);

  const markAll = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      await notifications.markAllRead(token);
      reload();
    } catch (thrown) {
      Alert.alert('Could not mark as read', messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  const open = async (item: Item) => {
    try {
      const token = await getToken();
      if (!item.isRead) await notifications.markRead(token, item.id);
    } catch {
      // A failed read-receipt must not block navigation.
    }
    const target = item.type === 'order' ? '/seller/orders' : item.type === 'message' ? '/seller/messages' : null;
    if (target) router.push(target as never);
    else reload();
  };

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="Notifications" showBack />
        <Loading label="Loading notifications…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="Notifications" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'Everything read'}
        showBack
      />
      {unread > 0 ? (
        <View style={styles.toolbar}>
          <Button label="Mark all read" variant="outline" loading={busy} onPress={markAll} />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void open(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title || 'Notification'}
            style={({ pressed }) => [
              styles.row,
              !item.isRead && styles.unread,
              pressed && { backgroundColor: colors.surfaceRaised },
            ]}
          >
            <View style={styles.dot}>
              <Ionicons
                name={item.isRead ? 'notifications-outline' : 'notifications'}
                size={18}
                color={item.isRead ? colors.textMuted : colors.primary}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title || 'Vidnov'}
              </Text>
              <Muted numberOfLines={3} style={styles.body}>
                {item.message || item.body || ''}
              </Muted>
              <Muted style={styles.time}>{shortDate(item.createdAt)}</Muted>
            </View>
            {!item.isRead ? <Badge label="New" tone="primary" /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="Nothing yet"
            body="Order updates, messages and shop reviews land here. Alert settings decide which ones reach your phone."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.xs, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  unread: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary },
  dot: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  title: { color: colors.text, ...type.bodyStrong },
  body: { fontSize: 12, lineHeight: 17 },
  time: { fontSize: 10 },
});
