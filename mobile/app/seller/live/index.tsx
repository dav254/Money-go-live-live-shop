import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  Card,
  Chip,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../../src/components/ui';
import { RequireAuth } from '../../../src/components/require-auth';
import { catalog } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth';
import { useResource } from '../../../src/lib/use-resource';
import { colors, radius, spacing, type } from '../../../src/theme';

/**
 * LIVE SELLING — the seller's own go-live screen.
 *
 * This used to send the seller to vidnov.com. It does not any more: the app
 * creates the live session itself through `POST /api/live/create`, the server
 * mints a publish-only LiveKit token, and `live/broadcast` publishes the
 * camera from the phone. Same room, same backend, same audience — the seller
 * never leaves the app.
 *
 * If the shop is already on air, starting a second room would split the
 * audience, so the screen offers to rejoin the running stream instead.
 */
export default function SellerLiveScreen() {
  return (
    <RequireAuth>
      <Live />
    </RequireAuth>
  );
}

const VISIBILITIES = [
  { value: 'PUBLIC', label: 'Everyone', detail: 'Anyone browsing Vidnov can watch' },
  { value: 'FOLLOWERS', label: 'Followers', detail: 'Only shops that follow you' },
  { value: 'CUSTOMERS', label: 'Customers', detail: 'Only people who bought from you' },
  { value: 'PRIVATE', label: 'Link only', detail: 'Only people you share the link with' },
] as const;

function Live() {
  const router = useRouter();
  const { session } = useAuth();
  const { data, loading, reload } = useResource(() => catalog.liveNow(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<(typeof VISIBILITIES)[number]['value']>('PUBLIC');

  const rooms = (data?.rooms ?? []).filter((room) => room.sellerId === session?.uid);
  const onAir = rooms[0];

  const start = () => {
    router.push({
      pathname: '/seller/live/broadcast',
      params: {
        title: title.trim() || 'Live from my shop',
        description: description.trim(),
        visibility,
      },
    });
  };

  return (
    <Screen>
      <SellerHeader title="Live selling" subtitle="Broadcast from your phone" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading && !data ? <Loading label="Checking live rooms…" /> : null}

        {onAir ? (
          <Card style={styles.onAir}>
            <View style={{ flex: 1, gap: 4 }}>
              <Badge label="LIVE" tone="primary" />
              <Text numberOfLines={2} style={styles.onAirTitle}>
                {onAir.title || 'Your live session'}
              </Text>
              <Muted>{onAir.viewerCount ?? 0} watching right now</Muted>
            </View>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/live/[id]',
                  params: { id: onAir.id, sellerId: session?.uid ?? '', title: onAir.title ?? '' },
                })
              }
              accessibilityRole="button"
              style={styles.watch}
            >
              <Ionicons name="eye-outline" size={16} color={colors.text} />
              <Text style={styles.watchText}>Watch</Text>
            </Pressable>
          </Card>
        ) : null}

        <Notice
          tone="neutral"
          title={onAir ? 'You are already on air' : 'Go live from Android'}
          body={
            onAir
              ? 'A room is already running for this shop. It will keep the audience together if you finish it before starting another.'
              : 'Your camera and microphone stream to the same live infrastructure the website uses. Viewers can watch, comment and open your listings while you talk.'
          }
        />

        <SectionHeader title="Stream details" />
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What are you showing today?"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={80}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="New arrivals, a demo, a Q&A…"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.textarea]}
            multiline
            maxLength={300}
          />
        </View>

        <SectionHeader title="Who can watch" />
        <View style={styles.chips}>
          {VISIBILITIES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={visibility === option.value}
              onPress={() => setVisibility(option.value)}
            />
          ))}
        </View>
        <Muted style={styles.hint}>
          {VISIBILITIES.find((option) => option.value === visibility)?.detail}
        </Muted>

        <Button
          label={onAir ? 'Start a second room anyway' : 'Start broadcast'}
          icon="radio-outline"
          onPress={start}
        />
        {onAir ? (
          <Button label="Refresh status" variant="ghost" icon="refresh" onPress={reload} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  onAir: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  onAirTitle: { ...type.bodyStrong, color: colors.text },
  watch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  watchText: { ...type.caption, color: colors.text, fontWeight: '700' },
  field: { gap: 6 },
  label: { ...type.caption, color: colors.textMuted, fontWeight: '700' },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...type.body,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hint: { fontSize: 12 },
});
