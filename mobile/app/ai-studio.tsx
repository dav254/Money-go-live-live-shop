import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import {
  Badge,
  Button,
  EmptyState,
  Heading,
  Muted,
  Screen,
  SectionHeader,
} from '../src/components/ui';
import { RequireAuth } from '../src/components/require-auth';
import { ai, messageFor } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { shortDate } from '../src/lib/format';
import { colors, radius, spacing, type } from '../src/theme';
import type { AiJob } from '../src/lib/types';

type Kind = 'text-to-image' | 'image-to-image';

/**
 * AI STUDIO — a native client for the same generation gateway the website uses.
 *
 * The job is created on the server (`POST /api/ai/generate`), which charges
 * points and returns an id immediately; this screen then polls
 * `GET /api/ai/jobs?id=…`. Nothing is generated on the device, and a job that
 * fails reports the server's reason rather than a spinner that never ends.
 *
 * Only the two image modes are exposed. Video generation exists in the backend
 * but its progress and playback need a media surface this build does not ship,
 * so it is not offered here rather than offered and broken.
 */
export default function AiStudioScreen() {
  return (
    <RequireAuth>
      <Studio />
    </RequireAuth>
  );
}

function Studio() {
  const { getToken } = useAuth();
  const [kind, setKind] = useState<Kind>('text-to-image');
  const [prompt, setPrompt] = useState('');
  const [source, setSource] = useState<{ uri: string; base64: string } | null>(null);
  const [job, setJob] = useState<AiJob | null>(null);
  const [recent, setRecent] = useState<AiJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const token = await getToken();
      const result = await ai.jobs(token);
      setRecent((result.jobs ?? []) as AiJob[]);
    } catch {
      // History is secondary; the composer must still work.
    }
  }, [getToken]);

  useEffect(() => {
    loadRecent();
    return stopPolling;
  }, [loadRecent, stopPolling]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Vidnov needs access to your photos to use your own image. You can grant it in Android settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('That image could not be read. Try another one.');
      return;
    }
    setSource({ uri: asset.uri, base64: asset.base64 });
    setKind('image-to-image');
    setError(null);
  };

  const generate = async () => {
    if (busy) return;
    setError(null);

    if (!prompt.trim() && !source) {
      setError('Describe what you want, or choose a photo to work from.');
      return;
    }
    if (kind === 'image-to-image' && !source) {
      setError('Choose a photo to edit.');
      return;
    }

    setBusy(true);
    setJob(null);
    try {
      const token = await getToken();
      const { jobId } = await ai.generate(token, {
        type: kind,
        prompt: prompt.trim() || undefined,
        ...(source ? { imageBase64: source.base64, imageMime: 'image/jpeg' } : {}),
      });

      // Poll until the job reaches a terminal state.
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const fresh = await getToken();
          const { job: current } = await ai.job(fresh, jobId);
          setJob(current as AiJob);
          if (['completed', 'failed'].includes(String(current?.status))) {
            stopPolling();
            setBusy(false);
            loadRecent();
          }
        } catch {
          // A dropped poll is not a failed generation — the next tick retries.
        }
      }, 3_000);
    } catch (thrown) {
      setError(messageFor(thrown));
      setBusy(false);
    }
  };

  const active = job ?? null;
  const progress = Math.max(0, Math.min(100, Number(active?.progress ?? 0)));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Heading>Make something</Heading>
            <Muted>
              Generations run on Vidnov&apos;s AI gateway and use your account points. Results are
              saved to your library.
            </Muted>
          </View>

          <View style={styles.modes}>
            <ModeButton
              label="From a prompt"
              icon="text-outline"
              active={kind === 'text-to-image'}
              onPress={() => setKind('text-to-image')}
            />
            <ModeButton
              label="From a photo"
              icon="image-outline"
              active={kind === 'image-to-image'}
              onPress={() => setKind('image-to-image')}
            />
          </View>

          {source ? (
            <View style={styles.sourceRow}>
              <Image source={{ uri: source.uri }} style={styles.sourceThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Muted>Source photo attached</Muted>
              </View>
              <Pressable onPress={() => setSource(null)} hitSlop={8} accessibilityLabel="Remove photo">
                <Ionicons name="close-circle" size={22} color={colors.textFaint} />
              </Pressable>
            </View>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Describe it</Text>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="A red neon storefront at night, product photo"
              placeholderTextColor={colors.textFaint}
              style={styles.prompt}
              multiline
              maxLength={600}
            />
          </View>

          <View style={styles.row}>
            <Button label="Choose photo" variant="outline" icon="images-outline" onPress={pickImage} />
            <Button
              label="Generate"
              icon="sparkles"
              onPress={generate}
              loading={busy}
              style={{ flex: 1 }}
            />
          </View>

          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {active ? (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Heading style={{ fontSize: 15 }}>
                  {active.status === 'completed'
                    ? 'Ready'
                    : active.status === 'failed'
                      ? 'Generation failed'
                      : 'Working…'}
                </Heading>
                <Badge
                  label={String(active.status || 'queued')}
                  tone={
                    active.status === 'completed'
                      ? 'success'
                      : active.status === 'failed'
                        ? 'danger'
                        : 'primary'
                  }
                />
              </View>

              {active.status === 'failed' ? (
                <Muted>{active.errorMessage || 'The generator could not finish this one.'}</Muted>
              ) : active.outputUrl ? (
                <Image source={{ uri: active.outputUrl }} style={styles.output} contentFit="cover" />
              ) : (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <Muted>{progress > 0 ? `${progress}%` : 'Queued'}</Muted>
                </View>
              )}

              {active.prompt ? <Muted numberOfLines={3}>{active.prompt}</Muted> : null}
            </View>
          ) : null}

          <SectionHeader title="Recent generations" />
          {recent.length === 0 ? (
            <EmptyState
              icon="sparkles-outline"
              title="Nothing generated yet"
              body="Your finished images appear here."
            />
          ) : (
            <View style={styles.grid}>
              {recent.slice(0, 12).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setJob(item)}
                  style={styles.gridItem}
                  accessibilityLabel={item.prompt || 'Generation'}
                >
                  {item.outputUrl || item.thumbnailUrl ? (
                    <Image
                      source={{ uri: (item.outputUrl || item.thumbnailUrl) as string }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.gridFallback]}>
                      {item.status === 'failed' ? (
                        <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
                      ) : (
                        <ActivityIndicator color={colors.primary} />
                      )}
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {recent.length > 0 ? <Muted>Latest {shortDate(String(recent[0]?.createdAt ?? ''))}</Muted> : null}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function ModeButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.mode, active && styles.modeActive]}
    >
      <Ionicons name={icon} size={17} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.modeLabel, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  intro: { gap: spacing.xs },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modeLabel: { color: colors.textMuted, ...type.caption, fontWeight: '700' },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  sourceThumb: { width: 48, height: 48, borderRadius: radius.sm },
  label: { color: colors.textMuted, ...type.caption },
  prompt: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: spacing.lg,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  error: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  output: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  progressWrap: { gap: spacing.sm },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  gridFallback: { alignItems: 'center', justifyContent: 'center' },
});
