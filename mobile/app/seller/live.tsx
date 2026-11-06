import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { catalog } from '../../src/lib/api';
import { API_BASE_URL } from '../../src/lib/config';
import { useAuth } from '../../src/lib/auth';
import { useResource } from '../../src/lib/use-resource';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * LIVE SELLING.
 *
 * The honest version. Vidnov's live rooms exist and the app can read them, but
 * this build has no mobile camera-publishing pipeline: the go-live flow on the
 * website negotiates a stream that the app does not create. So the screen shows
 * the seller's REAL live status from `/api/home/live` and says clearly that
 * starting a stream from Android is not available yet — rather than flipping a
 * switch that would announce a stream nobody can watch.
 */
export default function SellerLiveScreen() {
  return (
    <RequireAuth>
      <Live />
    </RequireAuth>
  );
}

function Live() {
  const { session } = useAuth();
  const { data, loading, reload } = useResource(() => catalog.liveNow(), []);

  const rooms = (data?.rooms ?? []).filter((room) => room.sellerId === session?.uid);

  return (
    <Screen>
      <SellerHeader title="Live selling" subtitle="Your live rooms" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {loading && !data ? (
          <Loading label="Checking live rooms…" />
        ) : rooms.length > 0 ? (
          <>
            <Muted>These rooms are currently live on Vidnov.</Muted>
            {rooms.map((room) => (
              <View key={room.id} style={styles.room}>
                <Badge label="LIVE" tone="primary" />
                <Text numberOfLines={2} style={styles.roomTitle}>
                  {room.title}
                </Text>
                <Muted>{room.viewerCount ?? 0} watching</Muted>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.status}>
            <View style={styles.statusIcon}>
              <Ionicons name="radio-outline" size={24} color={colors.textMuted} />
            </View>
            <Text style={styles.statusTitle}>You are not live</Text>
            <Muted style={{ textAlign: 'center' }}>
              No live room is running on this shop right now.
            </Muted>
          </View>
        )}

        <Notice
          tone="warning"
          title="Going live from this app is not available yet"
          body="Vidnov needs a camera and streaming pipeline on Android before Start Live can be real. This build does not create a live session record, so nothing here can announce a stream that is not actually running."
        />

        <SectionHeader title="What works today" />
        <View style={styles.list}>
          <Point text="Your live rooms show here and in Vidnov's live strip while they run." />
          <Point text="Products and photos you publish now appear in your live-ready shop." />
          <Point text="Go live from the seller studio on vidnov.com until the Android streamer ships." />
        </View>

        <Button
          label="Open go-live on vidnov.com"
          variant="outline"
          icon="open-outline"
          onPress={() => void Linking.openURL(`${API_BASE_URL}/app/seller/live`)}
        />
        <Button label="Refresh status" variant="ghost" icon="refresh" onPress={reload} />
      </ScrollView>
    </Screen>
  );
}

function Point({ text }: { text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name="checkmark-circle-outline" size={16} color={colors.textMuted} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  status: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  statusIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  room: {
    gap: spacing.xs,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  roomTitle: { color: colors.text, ...type.bodyStrong, fontSize: 16 },
  list: { gap: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  pointText: { color: colors.textMuted, ...type.body, flex: 1, lineHeight: 21 },
});
