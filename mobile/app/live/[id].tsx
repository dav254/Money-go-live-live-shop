import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveKitRoom, VideoTrack, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';

import { LiveChat } from '../../src/components/live/live-chat';
import { Badge, Button, ErrorState, Loading } from '../../src/components/ui';
import { live, messageFor } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { startLiveAudio, stopLiveAudio } from '../../src/lib/livekit';
import { API_BASE_URL } from '../../src/lib/config';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * LIVE VIEWER — the stream, in the app.
 *
 * It joins the exact LiveKit room the website's player joins: the viewer token
 * is minted by `/api/live-session/token`, which reads the room name from the
 * server's session record and grants subscribe-only permissions. Nothing here
 * invents a stream, a viewer count or a seller.
 *
 * The seller's camera is the stage. If no video track is published yet the
 * screen says the seller is connecting rather than showing a black rectangle.
 */
export default function LiveViewerScreen() {
  const router = useRouter();
  const { id, sellerId, title } = useLocalSearchParams<{
    id: string;
    sellerId?: string;
    title?: string;
  }>();
  const { status, getToken } = useAuth();

  const [session, setSession] = useState<{ token: string; wsUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const join = useCallback(async () => {
    if (!id) return;
    setError(null);
    setEnded(false);
    try {
      const token = status === 'signedIn' ? await getToken() : null;
      const result = await live.viewerToken(String(id), token);
      if (!result?.token || !result?.wsUrl) {
        setError('This live could not be joined. Try again in a moment.');
        return;
      }
      setSession({ token: result.token, wsUrl: result.wsUrl });
      await startLiveAudio();
    } catch (thrown) {
      setError(messageFor(thrown));
    }
  }, [getToken, id, status]);

  useEffect(() => {
    void join();
    return () => {
      void stopLiveAudio();
    };
  }, [join]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/live');
  };

  if (error) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.topRow}>
          <IconButton icon="close" label="Close" onPress={close} />
        </View>
        <ErrorState message={error} onRetry={() => void join()} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.root, styles.centre]}>
        <Pressable onPress={close} style={styles.floatingClose} accessibilityLabel="Close live">
          <Ionicons name="close" size={22} color={colors.text} />
        </Pressable>
        <Loading label="Joining the live room…" />
      </SafeAreaView>
    );
  }

  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.wsUrl}
      connect
      audio
      video={false}
      onDisconnected={() => setEnded(true)}
    >
      <View style={styles.root}>
        <Stage title={title || 'Live on Vidnov'} />

        <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top']}>
          <View style={styles.topRow} pointerEvents="box-none">
            <IconButton icon="close" label="Close live" onPress={close} />
            <View style={{ flex: 1 }} />
            <Badge label="LIVE" tone="primary" />
            <IconButton
              icon="share-social-outline"
              label="Share live"
              onPress={() =>
                void Share.share({
                  message: `${title || 'Live on Vidnov'} — watch on Vidnov: ${API_BASE_URL}/app/buyer/live/${id}`,
                })
              }
            />
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.bottom} edges={['bottom']}>
          {ended ? (
            <View style={styles.endedCard}>
              <Text style={styles.endedTitle}>This live has ended</Text>
              <Text style={styles.endedBody}>
                The seller stopped streaming. Their shop and listings are still open.
              </Text>
              {sellerId ? (
                <Button
                  label="Visit the shop"
                  variant="outline"
                  onPress={() => router.push(`/shop/${sellerId}`)}
                />
              ) : null}
            </View>
          ) : (
            <>
              <View style={styles.actions}>
                {sellerId ? (
                  <Pressable
                    onPress={() => router.push(`/shop/${sellerId}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.shopButton, pressed && { opacity: 0.85 }]}
                  >
                    <Ionicons name="storefront-outline" size={16} color={colors.text} />
                    <Text style={styles.shopButtonText}>Shop</Text>
                  </Pressable>
                ) : null}
                <View style={{ flex: 1 }} />
                <IconButton
                  icon={chatOpen ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                  label="Comments"
                  onPress={() => setChatOpen((open) => !open)}
                />
              </View>

              {chatOpen ? (
                <LiveChat sessionId={String(id)} compact />
              ) : (
                <Pressable onPress={() => setChatOpen(true)} style={styles.chatHint}>
                  <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.chatHintText}>Show comments</Text>
                </Pressable>
              )}
            </>
          )}
        </SafeAreaView>
      </View>
    </LiveKitRoom>
  );
}

/** The stage: the seller's camera (or screen share) at full width. */
function Stage({ title }: { title: string }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const remote = tracks.find((track) => !track.participant.isLocal) ?? tracks[0];

  return (
    <View style={styles.stage}>
      {remote?.publication?.videoTrack ? (
        <VideoTrack
          trackRef={remote}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
        />
      ) : (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.waitingText}>The seller is connecting…</Text>
        </View>
      )}
      <View style={styles.titleWrap} pointerEvents="none">
        <Text numberOfLines={2} style={styles.title}>
          {title}
        </Text>
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, backgroundColor: '#000' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  waitingText: { ...type.caption, color: colors.textMuted },
  titleWrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
  title: { ...type.bodyStrong, color: colors.white },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingClose: { position: 'absolute', top: spacing.xl, right: spacing.md, zIndex: 2 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  shopButtonText: { ...type.caption, color: colors.text, fontWeight: '700' },
  chatHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignSelf: 'flex-start',
  },
  chatHintText: { ...type.caption, color: colors.textMuted },
  endedCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(16,16,16,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  endedTitle: { ...type.bodyStrong, color: colors.text },
  endedBody: { ...type.caption, color: colors.textMuted },
});
