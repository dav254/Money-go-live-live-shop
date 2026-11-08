import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  Badge,
  Body,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { commerce } from '../../src/lib/api';
import { money, preview, shortDate, titleCase } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * REQUESTS — the buyer side of the brief → offer → order flow.
 *
 * Reads `GET /api/requests?scope=mine`, the same endpoint the website's buyer
 * requests page uses. The server scopes the list to the verified account, so
 * the app can never show another buyer's briefs.
 *
 * Pulling up a brief opens the native detail screen where the offers can be
 * compared and one accepted (which is what creates the order server-side).
 */
export default function RequestsScreen() {
  return (
    <RequireAuth>
      <Requests />
    </RequireAuth>
  );
}

function Requests() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const mine = useAuthedResource((token) => commerce.myRequests(token), []);

  // A brief posted on another screen must appear here without a relaunch.
  useFocusEffect(
    useCallback(() => {
      mine.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const requests: any[] = Array.isArray(mine.data?.requests) ? mine.data!.requests : [];
  const active = requests.filter((item) => item.status === 'active');
  const past = requests.filter((item) => item.status !== 'active');

  const refresh = useCallback(async () => {
    setRefreshing(true);
    mine.reload();
    setRefreshing(false);
  }, [mine]);

  return (
    <Screen>
      <FlatList
        data={requests}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <View style={styles.intro}>
              <View style={{ flex: 1, gap: 4 }}>
                <Heading style={styles.title}>What do you need?</Heading>
                <Muted>
                  Post a brief and matched Vidnov sellers reply with offers you can
                  compare.
                </Muted>
              </View>
              <Ionicons name="document-text-outline" size={26} color={colors.primary} />
            </View>

            <Button
              label="Post a request"
              icon="add"
              onPress={() => router.push('/request/new')}
            />

            {active.length > 0 ? <SectionHeader title="Open briefs" /> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/request/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Open brief ${item.title || ''}`}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.cardHeader}>
              <Heading style={styles.cardTitle}>{item.title || 'Untitled brief'}</Heading>
              <Badge
                label={titleCase(String(item.status || 'active'))}
                tone={item.status === 'active' ? 'primary' : 'neutral'}
              />
            </View>

            {item.description ? <Muted>{preview(String(item.description), 140)}</Muted> : null}

            <View style={styles.metaRow}>
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
              {item.budgetMax || item.budgetMin ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {money(item.budgetMin ?? undefined, item.currency)} –{' '}
                    {money(item.budgetMax ?? undefined, item.currency)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footerRow}>
              <View style={styles.footerLeft}>
                <Ionicons name="pricetag-outline" size={13} color={colors.primary} />
                <Text style={styles.offersText}>
                  {Number(item.offersCount ?? 0)} offer
                  {Number(item.offersCount ?? 0) === 1 ? '' : 's'}
                </Text>
                {item.acceptedOfferId ? <Badge label="Accepted" tone="success" /> : null}
              </View>
              <Muted>{item.createdAt ? shortDate(String(item.createdAt)) : ''}</Muted>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          mine.loading && !mine.data ? (
            <Loading label="Loading your briefs…" />
          ) : mine.error ? (
            <ErrorState message={mine.error} onRetry={mine.reload} />
          ) : (
            <EmptyState
              icon="document-text-outline"
              title="No requests yet"
              body="Post what you are looking for — a product, a service, a repair. Matched sellers will reply with offers."
              action={<Button label="Post a request" onPress={() => router.push('/request/new')} />}
            />
          )
        }
        ListFooterComponent={
          past.length > 0 ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
              <Muted>
                {past.length} closed brief{past.length === 1 ? '' : 's'} are listed above with their
                final status.
              </Muted>
            </View>
          ) : undefined
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl * 2, flexGrow: 1 },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: { fontSize: 18 },
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  offersText: { color: colors.text, ...type.caption, fontWeight: '700' },
});
