import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { RequireAuth } from '../../src/components/require-auth';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Card,
  ErrorState,
  ListRow,
  Loading,
  Muted,
  Notice,
  Screen,
  ScrollScreen,
  SectionHeader,
  StatTile,
} from '../../src/components/ui';
import { account } from '../../src/lib/api';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing } from '../../src/theme';

/**
 * AI POINTS (seller) — the balance and what spends it.
 *
 * The number is `aiPoints` on the profile document, the same field the website
 * reads and the same one a boost is charged against. There is no top-up here:
 * buying points is a payment flow that does not exist on this surface, and a
 * button that cannot complete is worse than a sentence that says so.
 */
export default function SellerPointsScreen() {
  return (
    <RequireAuth>
      <Points />
    </RequireAuth>
  );
}

function Points() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource(
    (token) => account.profile(token),
    [],
  );

  const profile = (data?.profile ?? {}) as { aiPoints?: number };
  const points = Number(profile.aiPoints) || 0;

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="AI points" showBack />
        <Loading label="Reading your balance…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="AI points" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader title="AI points" showBack />
      <ScrollScreen>
        <Card style={styles.balance}>
          <StatTile label="Points balance" value={points.toLocaleString()} tone="primary" />
          <Muted style={styles.note}>
            Spent by AI Studio generations and by paid boosts. Free distribution never touches this
            balance.
          </Muted>
        </Card>

        <SectionHeader title="What spends points" />
        <ListRow
          icon="sparkles-outline"
          title="AI Studio"
          detail="Generate listings, captions and images"
          onPress={() => router.push('/seller/ai')}
        />
        <ListRow
          icon="trending-up-outline"
          title="Paid boosts"
          detail="100 points per day, reviewed by the team"
          onPress={() => router.push('/seller/growth')}
        />

        <SectionHeader title="What earns them back" />
        <ListRow
          icon="gift-outline"
          title="Invite & earn"
          detail="Referral points are a separate, spendable balance"
          onPress={() => router.push('/seller/rewards')}
        />

        <Notice
          title="No top-up in this build"
          body="Points are added by the platform (purchases, promotions, support). The app will not offer a buy button until the payment flow exists on this surface."
        />
      </ScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  note: { fontSize: 12, lineHeight: 17 },
});
