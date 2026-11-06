import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Screen,
} from '../src/components/ui';
import { RequireAuth } from '../src/components/require-auth';
import { commerce } from '../src/lib/api';
import { money, preview, shortDate, titleCase } from '../src/lib/format';
import { useAuthedResource } from '../src/lib/use-authed';
import { colors, radius, spacing, type } from '../src/theme';

type Segment = 'mine' | 'open' | 'offers';

/**
 * REQUESTS & OFFERS.
 *
 * The marketplace's two-sided flow, native: a buyer posts a brief, sellers
 * reply with offers, the buyer accepts. Both sides already exist on the website
 * (`/api/requests`, `/api/requests/offers`) — this screen reads those same
 * endpoints; it does not create a second request system.
 *
 * Every list is scoped by the server to the verified account, so "open briefs"
 * is the only genuinely public one and it still requires a session.
 */
export default function OffersScreen() {
  return (
    <RequireAuth>
      <OffersView />
    </RequireAuth>
  );
}

function OffersView() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('mine');

  const mine = useAuthedResource(
    (token) => commerce.myRequests(token),
    [],
    { enabled: segment === 'mine' },
  );
  const open = useAuthedResource(
    (token) => commerce.openRequests(token),
    [],
    { enabled: segment === 'open' },
  );
  const offers = useAuthedResource(
    (token) => commerce.sellerOffers(token),
    [],
    { enabled: segment === 'offers' },
  );

  const active = segment === 'mine' ? mine : segment === 'open' ? open : offers;
  const requests = segment === 'mine' ? mine.data?.requests ?? [] : segment === 'open' ? open.data?.requests ?? [] : [];
  const offerRows = segment === 'offers' ? offers.data?.offers ?? [] : [];

  return (
    <Screen>
      <View style={styles.segments}>
        <SegmentButton label="My briefs" active={segment === 'mine'} onPress={() => setSegment('mine')} />
        <SegmentButton label="Open briefs" active={segment === 'open'} onPress={() => setSegment('open')} />
        <SegmentButton label="My offers" active={segment === 'offers'} onPress={() => setSegment('offers')} />
      </View>

      {active.loading && !active.data ? (
        <Loading label="Loading…" />
      ) : active.error ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : segment === 'offers' ? (
        <FlatList
          data={offerRows}
          keyExtractor={(offer: any) => offer.id}
          contentContainerStyle={styles.list}
          refreshing={offers.loading}
          onRefresh={offers.reload}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Heading style={styles.cardTitle}>{titleCase(String(item.status || 'draft'))}</Heading>
                <Text style={styles.amount}>{money(item.price, item.currency)}</Text>
              </View>
              {item.message ? (
                <Muted>{preview(String(item.message), 140)}</Muted>
              ) : null}
              <View style={styles.footerRow}>
                {item.deliveryDays ? <Muted>{item.deliveryDays} days delivery</Muted> : <View />}
                {item.createdAt ? <Muted>{shortDate(String(item.createdAt))}</Muted> : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="pricetag-outline"
              title="No offers sent"
              body="Offers you send on buyers' briefs appear here with their status."
              action={
                <Button
                  label="Browse open briefs"
                  variant="outline"
                  onPress={() => setSegment('open')}
                />
              }
            />
          }
        />
      ) : (
        <FlatList
          data={requests as any[]}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          refreshing={active.loading}
          onRefresh={active.reload}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push('/(tabs)/discover')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.cardHeader}>
                <Heading style={styles.cardTitle}>{item.title || 'Untitled brief'}</Heading>
                <Badge
                  label={titleCase(String(item.status || 'open'))}
                  tone={item.status === 'active' ? 'primary' : 'neutral'}
                />
              </View>
              {item.description ? <Muted>{preview(String(item.description), 130)}</Muted> : null}
              <View style={styles.footerRow}>
                <View style={styles.chips}>
                  {item.category ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{item.category}</Text>
                    </View>
                  ) : null}
                  {item.location ? (
                    <View style={styles.chip}>
                      <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.chipText}>{item.location}</Text>
                    </View>
                  ) : null}
                </View>
                <Muted>
                  {Number(item.offersCount ?? 0)} offer{Number(item.offersCount ?? 0) === 1 ? '' : 's'}
                </Muted>
              </View>
              {item.budgetMax || item.budgetMin ? (
                <Muted>
                  Budget {money(item.budgetMin ?? undefined, item.currency)} –{' '}
                  {money(item.budgetMax ?? undefined, item.currency)}
                </Muted>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title={segment === 'mine' ? 'No briefs posted' : 'No open briefs'}
              body={
                segment === 'mine'
                  ? 'Post what you need and sellers reply with offers.'
                  : 'Nothing is open right now. Check back shortly.'
              }
            />
          }
        />
      )}
    </Screen>
  );
}

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.segment, active && styles.segmentActive]}
    >
      <Text style={[styles.segmentText, active && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  segmentText: { color: colors.textMuted, ...type.caption, fontWeight: '700' },
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 16 },
  amount: { color: colors.text, fontSize: 16, fontWeight: '800' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
});
