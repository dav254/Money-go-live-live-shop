import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Badge, Button, EmptyState, ErrorState, Loading, Muted, Screen } from '../../src/components/ui';
import { catalog } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useResource } from '../../src/lib/use-resource';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * LIVE DISCOVERY.
 *
 * The sessions running on Vidnov right now, from `/api/home/live` — the same
 * public strip the website shows. Tapping a card opens the stream itself
 * inside the app (`/live/[id]`), which connects to the same LiveKit room the
 * website's player joins. No browser hand-off, no simulated viewer counts.
 */
export default function LiveScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const { data, loading, error, reload } = useResource(() => catalog.liveNow(), []);

  const rooms = (data?.rooms ?? []) as Array<{
    id: string;
    sellerId: string;
    title: string;
    viewerCount: number;
    sellerName?: string;
    shopName?: string;
    thumbnailUrl?: string;
  }>;

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Finding live sellers…" />
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
      <View style={styles.intro}>
        <Muted>
          Sellers broadcasting on Vidnov right now. Video plays in the app, from the same live
          rooms the website uses.
          {status === 'signedIn' ? '' : ' Sign in to comment or buy during the stream.'}
        </Muted>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(room) => room.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/live/[id]',
                params: { id: item.id, sellerId: item.sellerId, title: item.title ?? '' },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`${item.title || 'Live session'}, ${item.viewerCount} watching`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.media}>
              <View style={[StyleSheet.absoluteFill, styles.mediaFallback]} />
              <View style={styles.mediaOverlay}>
                <Badge label="LIVE" tone="primary" />
                <View style={styles.viewers}>
                  <Ionicons name="eye-outline" size={12} color={colors.text} />
                  <Text style={styles.viewerText}>{item.viewerCount ?? 0} watching</Text>
                </View>
              </View>
            </View>
            <View style={styles.body}>
              <Text numberOfLines={2} style={styles.title}>
                {item.title || 'Live session'}
              </Text>
              <Muted>{item.shopName || item.sellerName || 'Tap to watch'}</Muted>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="radio-outline"
            title="Nobody is live right now"
            body="Sessions appear here the moment a seller goes live. You can browse their shops in the meantime."
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
  intro: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  media: { height: 150, backgroundColor: colors.surfaceRaised },
  mediaFallback: { backgroundColor: colors.primarySoft },
  mediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  viewerText: { ...type.caption, color: colors.text },
  body: { padding: spacing.md, gap: 4 },
  title: { ...type.bodyStrong, color: colors.text },
});
