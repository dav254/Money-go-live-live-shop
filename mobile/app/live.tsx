import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Badge, Button, EmptyState, ErrorState, Loading, Muted, Screen } from '../src/components/ui';
import { catalog } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useResource } from '../src/lib/use-resource';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * LIVE DISCOVERY.
 *
 * The public "on air right now" strip the website puts on its landing page,
 * rendered natively: real sessions, real viewer counts, the same
 * `/api/home/live` endpoint (which itself reads the VPS store before
 * Firestore).
 *
 * PLAYBACK IS NOT CLAIMED. Watch parties run on LiveKit, whose React Native
 * client is a native module this build does not bundle. Rather than opening a
 * browser tab (forbidden — that is the website doing the work) or showing a
 * fake player, the screen states plainly that in-app live video is not in this
 * build yet. Discovery works; watching does not pretend to.
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
  }>;

  if (loading && !data) return <Loading label="Finding live sellers…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <Screen>
      <View style={styles.intro}>
        <Muted>
          Sellers broadcasting on Vidnov right now. Sessions are hosted by the same live
          infrastructure the website uses.
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
            onPress={() => router.push(`/shop/${item.sellerId}`)}
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
              <Muted>Tap to open the seller&apos;s shop</Muted>
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

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Muted style={{ flex: 1 }}>
          In-app live video needs the LiveKit native module, which is not bundled in this build.
          Discovery, seller shops and live counts work{status === 'signedIn' ? '' : ' without an account'}.
        </Muted>
      </View>
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,10,11,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  viewerText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  body: { padding: spacing.md, gap: 3 },
  title: { color: colors.text, ...type.bodyStrong },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
});
