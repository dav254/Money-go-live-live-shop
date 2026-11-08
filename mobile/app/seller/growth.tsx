import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SellerHeader } from '../../src/components/seller/seller-header';
import { RemoteImage } from '../../src/components/remote-image';
import {
  Badge,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { useAuth } from '../../src/lib/auth';
import { growth, messageFor, type GrowthFreeResult } from '../../src/lib/api';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER · PRODUCT GROWTH CENTRE.
 *
 * The phone version of `/dashboard/seller/product-growth`. It calls the SAME
 * API, so the seller is looking at one campaign list with two front doors —
 * there is no mobile-only queue to fall out of step.
 *
 * Deliberately light for lower-end Android hardware and slow links:
 *   • one request on open (`growth.centre`);
 *   • 48dp thumbnails, no video, no animation loops;
 *   • every action is a single POST that returns what happened, rather than
 *     optimistic UI that has to be reconciled later.
 *
 * Nothing here promises reach: a prepared job is shown as "Prepared", and the
 * note from the server (`a job in the queue is a submission attempt…`) is
 * surfaced verbatim instead of being reworded per platform.
 */

const DAYS = [1, 3, 7, 14, 30];

const STATUS_TINT: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  ready: 'neutral',
  queued: 'primary',
  processing: 'warning',
  submitted: 'primary',
  live: 'success',
  failed: 'danger',
  needs_attention: 'warning',
  stopped: 'neutral',
  not_configured: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  completed: 'success',
  active: 'primary',
};

const STATUS_LABEL: Record<string, string> = {
  ready: 'Prepared',
  queued: 'Queued',
  processing: 'Sending',
  submitted: 'Accepted',
  live: 'Verified live',
  failed: 'Failed',
  needs_attention: 'Needs attention',
  stopped: 'Stopped',
  not_configured: 'Not connected',
  pending: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  active: 'Running',
};

export default function SellerGrowthScreen() {
  return (
    <RequireAuth>
      <GrowthCentre />
    </RequireAuth>
  );
}

function GrowthCentre() {
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => growth.centre(token), []);

  const [selected, setSelected] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[] | null>(null);
  const [mode, setMode] = useState<'free' | 'paid'>('free');
  const [primary, setPrimary] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GrowthFreeResult[] | null>(null);

  const products = data?.products ?? [];
  const destinations = data?.destinations ?? [];
  const activeChannels = useMemo(
    () => channels ?? destinations.filter((d) => d.canSubmit).map((d) => d.id),
    [channels, destinations],
  );

  const primaryProduct = products.find((p) => p.id === primary) ?? null;
  const cost = (data?.points.perDay ?? 100) * days;
  const balance = data?.points.balance ?? 0;
  const canAfford = balance >= cost;

  const toggleProduct = (id: string) => {
    setSelected((current) => {
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      if (!primary || !next.includes(primary)) setPrimary(next[0] ?? '');
      return next;
    });
  };

  const toggleChannel = (id: string) => {
    setChannels((current) => {
      const list = current ?? destinations.filter((d) => d.canSubmit).map((d) => d.id);
      return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    });
  };

  const submitFree = async () => {
    if (selected.length === 0) {
      Alert.alert('Pick a listing', 'Select at least one listing to distribute.');
      return;
    }
    if (activeChannels.length === 0) {
      Alert.alert('Pick a destination', 'Select at least one available destination.');
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const token = await getToken();
      const payload = await growth.submitFree(token, {
        productIds: selected,
        channels: activeChannels,
      });
      setResults(payload.results);
      Alert.alert(
        `${payload.submitted} job${payload.submitted === 1 ? '' : 's'} prepared`,
        payload.skipped > 0 ? `${payload.skipped} skipped. ${payload.note}` : payload.note,
      );
      reload();
    } catch (thrown) {
      Alert.alert('Could not submit', messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  const submitPaid = async () => {
    if (!primaryProduct) {
      Alert.alert('Pick a listing', 'Select the listing you want to boost.');
      return;
    }
    if (!canAfford) {
      Alert.alert('Not enough points', `This boost needs ${cost.toLocaleString()} points.`);
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const payload = await growth.submitPaid(token, {
        productId: primaryProduct.id,
        durationDays: days,
        caption: caption.trim() || primaryProduct.suggestedCaption,
      });
      Alert.alert(
        'Boost requested',
        `${payload.costPoints.toLocaleString()} points held · ${payload.remainingPoints.toLocaleString()} left. ${payload.note}`,
      );
      setCaption('');
      reload();
    } catch (thrown) {
      Alert.alert('Boost not submitted', messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="Growth centre" showBack />
        <Loading label="Reading your listings…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="Growth centre" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader
        title="Growth centre"
        subtitle={`${balance.toLocaleString()} points`}
        showBack
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          title="Prepared is not published"
          body="A job in the queue is a submission attempt. Vidnov only reports indexing, reach or sales when the destination itself confirmed them."
        />

        <SectionHeader title="1 · Choose listings" />
        {products.length === 0 ? (
          <Muted>No listings yet. Add a product first and it will appear here.</Muted>
        ) : (
          products.map((product) => {
            const on = selected.includes(product.id);
            return (
              <Pressable
                key={product.id}
                onPress={() => product.eligible && toggleProduct(product.id)}
                disabled={!product.eligible}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !product.eligible }}
                accessibilityLabel={product.name}
                style={({ pressed }) => [
                  styles.productRow,
                  on && { borderColor: colors.primary, backgroundColor: colors.primarySoft },
                  !product.eligible && { opacity: 0.55 },
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <View style={styles.thumb}>
                  <RemoteImage
                    source={product.imageUrl}
                    style={styles.thumbImage}
                    radius={radius.sm}
                    label={product.name}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Muted numberOfLines={1}>
                    {product.price == null
                      ? 'Price on request'
                      : `${product.currency ?? ''} ${product.price.toLocaleString()}`.trim()}
                    {product.listingType === 'service' ? ' · Service' : ' · Product'}
                  </Muted>
                  {!product.eligible ? (
                    <Text style={styles.reason} numberOfLines={1}>
                      {product.reasons.join(', ').replace(/_/g, ' ')}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={on ? colors.primary : colors.textFaint}
                />
              </Pressable>
            );
          })
        )}

        {primaryProduct ? (
          <Card style={styles.preview}>
            <Badge label="Sponsored preview" tone="primary" />
            <Text style={styles.previewName}>{primaryProduct.name}</Text>
            <Muted numberOfLines={2}>
              {caption.trim() || primaryProduct.suggestedCaption}
            </Muted>
          </Card>
        ) : null}

        <SectionHeader title="2 · How to promote" />
        <View style={styles.modeRow}>
          <Chip label="Free growth" active={mode === 'free'} onPress={() => setMode('free')} />
          <Chip label="Paid boost" active={mode === 'paid'} onPress={() => setMode('paid')} />
        </View>

        {mode === 'free' ? (
          <View style={{ gap: spacing.sm }}>
            {(['vidnov', 'search', 'commerce'] as const).map((group) => {
              const rows = destinations.filter((destination) => destination.group === group);
              if (rows.length === 0) return null;
              const title =
                group === 'vidnov'
                  ? 'Vidnov platform'
                  : group === 'search'
                    ? 'Search engines'
                    : 'Commerce feeds';
              return (
                <View key={group} style={{ gap: spacing.xs }}>
                  <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>
                  {rows.map((destination) => {
                    const on = activeChannels.includes(destination.id);
                    return (
                      <Pressable
                        key={destination.id}
                        onPress={() => destination.canSubmit && toggleChannel(destination.id)}
                        disabled={!destination.canSubmit}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on, disabled: !destination.canSubmit }}
                        accessibilityLabel={destination.label}
                        style={({ pressed }) => [
                          styles.destinationRow,
                          on && destination.canSubmit && { borderColor: colors.primary },
                          !destination.canSubmit && { opacity: 0.5 },
                          pressed && { backgroundColor: colors.surfaceRaised },
                        ]}
                      >
                        <Ionicons
                          name={on && destination.canSubmit ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={on && destination.canSubmit ? colors.primary : colors.textFaint}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{destination.label}</Text>
                          <Muted style={{ fontSize: 11 }}>
                            {destination.canSubmit
                              ? `${destination.quotas.perRun}/run · ${destination.quotas.perDay}/day`
                              : 'Not connected on Vidnov yet'}
                          </Muted>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            {(data?.social ?? []).length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.groupTitle}>SOCIAL ACCOUNTS</Text>
                {(data?.social ?? []).map((account) => (
                  <View key={account.id} style={styles.destinationRow}>
                    <Ionicons
                      name={account.connected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={account.connected ? colors.success : colors.textFaint}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{account.label}</Text>
                      <Muted style={{ fontSize: 11 }} numberOfLines={2}>
                        {account.note}
                      </Muted>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <Button
              label={busy ? 'Preparing…' : `Prepare ${selected.length} × ${activeChannels.length}`}
              onPress={submitFree}
              loading={busy}
              disabled={busy}
              icon="send-outline"
            />

            {results ? (
              <View style={styles.results}>
                {results.map((row) => (
                  <View key={`${row.productId}-${row.channel}`} style={styles.resultRow}>
                    <Ionicons
                      name={row.ok ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={row.ok ? colors.success : colors.warning}
                    />
                    <Text style={styles.resultText} numberOfLines={2}>
                      {row.channel}: {row.ok ? STATUS_LABEL[row.status ?? 'ready'] : row.message}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.groupTitle}>CAMPAIGN LENGTH</Text>
            <View style={styles.modeRow}>
              {DAYS.map((option) => (
                <Chip
                  key={option}
                  label={`${option}d`}
                  active={days === option}
                  onPress={() => setDays(option)}
                />
              ))}
            </View>

            <Field
              label="Caption"
              value={caption}
              onChangeText={(value) => setCaption(value.slice(0, 280))}
              placeholder={primaryProduct?.suggestedCaption ?? 'What should the boost say?'}
              multiline
            />

            <View style={styles.costRow}>
              <Ionicons name="ribbon-outline" size={16} color={colors.warning} />
              <Text style={styles.costText}>
                {cost.toLocaleString()} points · balance {balance.toLocaleString()}
              </Text>
              {!canAfford ? <Badge label="Not enough" tone="warning" /> : null}
            </View>

            <Button
              label={busy ? 'Requesting…' : 'Request boost'}
              onPress={submitPaid}
              loading={busy}
              disabled={busy || !primaryProduct || !canAfford}
              icon="sparkles-outline"
            />
            <Muted style={{ fontSize: 11 }}>
              Points are held when the request is created and returned if it is rejected. A boost
              buys Vidnov placement; it never promises search indexing, social reach or sales.
            </Muted>
          </View>
        )}

        <SectionHeader title="Distribution jobs" />
        {(data?.campaigns ?? []).length === 0 ? (
          <Muted>Nothing distributed yet.</Muted>
        ) : (
          (data?.campaigns ?? []).map((job) => (
            <View key={job.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {job.channel ?? 'channel'}
                </Text>
                <Muted numberOfLines={1} style={{ fontSize: 11 }}>
                  {products.find((p) => p.id === job.productId)?.name ?? job.productId}
                </Muted>
                {job.lastError?.message ? (
                  <Text style={styles.reason} numberOfLines={2}>
                    {job.lastError.message}
                  </Text>
                ) : null}
              </View>
              <Badge
                label={STATUS_LABEL[job.status] ?? job.status}
                tone={STATUS_TINT[job.status] ?? 'neutral'}
              />
            </View>
          ))
        )}

        <SectionHeader title="Boost requests" />
        {(data?.boosts ?? []).length === 0 ? (
          <Muted>No boost requested yet.</Muted>
        ) : (
          (data?.boosts ?? []).map((boost) => (
            <View key={boost.id} style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {products.find((p) => p.id === boost.productId)?.name ?? boost.productId}
                </Text>
                <Muted style={{ fontSize: 11 }}>
                  {boost.pointsPaid.toLocaleString()} points
                  {boost.durationDays ? ` · ${boost.durationDays} days` : ''}
                  {boost.rejectionReason ? ` · ${boost.rejectionReason}` : ''}
                </Muted>
              </View>
              <Badge
                label={STATUS_LABEL[boost.status] ?? boost.status}
                tone={STATUS_TINT[boost.status] ?? 'neutral'}
              />
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 2 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  thumbImage: { width: '100%', height: '100%' },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  name: { color: colors.text, ...type.bodyStrong },
  reason: { color: colors.warning, ...type.caption },
  groupTitle: {
    color: colors.textFaint,
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preview: { gap: 4 },
  previewName: { color: colors.text, ...type.heading },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  costText: { color: colors.text, ...type.bodyStrong, flex: 1 },
  results: { gap: 4, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultText: { color: colors.textMuted, ...type.caption, flex: 1 },
});
