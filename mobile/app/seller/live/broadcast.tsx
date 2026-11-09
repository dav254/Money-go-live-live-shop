import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native';
import { Track } from 'livekit-client';

import { LiveChat } from '../../../src/components/live/live-chat';
import { Button, ErrorState, Muted } from '../../../src/components/ui';
import { live, messageFor } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth';
import { startLiveAudio, stopLiveAudio } from '../../../src/lib/livekit';
import { colors, radius, spacing, type } from '../../../src/theme';

/**
 * BROADCAST — the seller's camera, published from the phone.
 *
 * The room is created here through `POST /api/live/create`; the server picks
 * the room name and hands back a token that can publish. Leaving this screen
 * ends the session record through `DELETE /api/live/[id]`, so the live list
 * stops advertising a room nobody is in.
 *
 * There is no viewer counter on this screen: the publisher's room only knows
 * who joined LiveKit, not the site's stored count, and a number that disagrees
 * with what buyers see would be worse than no number.
 */
export default function BroadcastScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{ title?: string; description?: string; visibility?: string }>();

  const [session, setSession] = useState<{ id: string; token: string; wsUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef(false);

  const start = useCallback(async () => {
    if (creating.current) return;
    creating.current = true;
    setError(null);
    try {
      const token = await getToken();
      const created = await live.create(token, {
        title: String(params.title || 'Live from my shop'),
        description: params.description ? String(params.description) : undefined,
        visibility: (params.visibility as 'PUBLIC' | 'FOLLOWERS' | 'CUSTOMERS' | 'PRIVATE') || 'PUBLIC',
      });
      const id = created?.stream?.id;
      if (!id || !created.token || !created.wsUrl) {
        setError('The stream could not be started. Try again in a moment.');
        return;
      }
      setSession({ id, token: created.token, wsUrl: created.wsUrl });
      await startLiveAudio();
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      creating.current = false;
    }
  }, [getToken, params.description, params.title, params.visibility]);

  useEffect(() => {
    void start();
    return () => {
      void stopLiveAudio();
    };
  }, [start]);

  if (error) {
    return (
      <SafeAreaView style={styles.plain}>
        <ErrorState message={error} onRetry={() => void start()} />
        <Button label="Back to live selling" variant="ghost" onPress={() => router.replace('/seller/live')} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.plain, styles.centre]}>
        <ActivityIndicator color={colors.primary} />
        <Muted>Opening your live room…</Muted>
      </SafeAreaView>
    );
  }

  return (
    <LiveKitRoom
      token={session.token}
      serverUrl={session.wsUrl}
      connect
      audio
      video
      onDisconnected={() => router.replace('/seller/live')}
    >
      <Studio sessionId={session.id} getToken={getToken} />
    </LiveKitRoom>
  );
}

function Studio({
  sessionId,
  getToken,
}: {
  sessionId: string;
  getToken: () => Promise<string>;
}) {
  const router = useRouter();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const local = cameraTracks.find((track) => track.participant.isLocal);
  const [seconds, setSeconds] = useState(0);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      /* the control stays where the device left it */
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      /* same */
    }
  };

  const end = () => {
    Alert.alert('End this live?', 'Buyers will stop seeing the stream. The recording, if any, stays on the website.', [
      { text: 'Keep streaming', style: 'cancel' },
      {
        text: 'End live',
        style: 'destructive',
        onPress: async () => {
          setEnding(true);
          try {
            const token = await getToken();
            await live.end(token, sessionId);
          } catch {
            // The local disconnect below still closes the room; the server
            // watchdog ends a room with no publisher.
          } finally {
            await localParticipant.setCameraEnabled(false).catch(() => undefined);
            router.replace('/seller/live');
          }
        },
      },
    ]);
  };

  const minutes = Math.floor(seconds / 60);
  const clock = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <View style={styles.root}>
      <View style={styles.preview}>
        {local?.publication?.videoTrack ? (
          <VideoTrack trackRef={local} style={StyleSheet.absoluteFill} objectFit="cover" />
        ) : (
          <View style={styles.centre}>
            <Ionicons name="videocam-off-outline" size={30} color={colors.textMuted} />
            <Muted>Camera is off</Muted>
          </View>
        )}
      </View>

      <SafeAreaView edges={['top']} style={styles.top}>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Text style={styles.clock}>{clock}</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bottom}>
        <View style={styles.controls}>
          <Control
            icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
            label={isMicrophoneEnabled ? 'Mute microphone' : 'Unmute microphone'}
            active={isMicrophoneEnabled}
            onPress={() => void toggleMic()}
          />
          <Control
            icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
            label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            active={isCameraEnabled}
            onPress={() => void toggleCamera()}
          />
          <Pressable
            onPress={end}
            disabled={ending}
            accessibilityRole="button"
            accessibilityLabel="End live"
            style={({ pressed }) => [styles.endButton, pressed && { opacity: 0.85 }]}
          >
            {ending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.endText}>End</Text>
            )}
          </Pressable>
        </View>

        <LiveChat sessionId={sessionId} compact />
      </SafeAreaView>
    </View>
  );
}

function Control({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.control, !active && styles.controlOff, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  plain: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  preview: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0 },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    margin: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveText: { ...type.caption, color: colors.white, fontWeight: '800', letterSpacing: 0.6 },
  clock: { ...type.caption, color: colors.textMuted },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: spacing.sm },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  control: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37,37,37,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlOff: { backgroundColor: 'rgba(240,68,56,0.85)' },
  endButton: {
    minWidth: 84,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  endText: { ...type.bodyStrong, color: colors.white },
});
