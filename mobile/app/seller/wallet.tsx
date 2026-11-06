import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  ErrorState,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
  StatTile,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { seller } from '../../src/lib/api';
import { money, shortDate, titleCase } from '../../src/lib/format';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * WALLET — the seller's real money records.
 *
 * There is no spendable balance in this response because Vidnov does not hold
 * one in this backend: payouts are requested against delivered orders and
 * recorded as payout rows. Showing a derived "available" number would be an
 * invented figure, so the screen shows the four values that genuinely exist and
 * says what they mean.
 */
export default function SellerWalletScreen() {
  return (
    <RequireAuth>
      <Wallet />
    </RequireAuth>
  );
}

function Wallet() {
  const { data, loading, error, reload } = useAuthedResource((token) => seller.wallet(token), []);

  return (
    <Screen>
      <SellerHeader title="Wallet" subtitle="Sales, payouts and methods" showBack />
      {loading && !data ? (
        <Loading label="Reading your records…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            <StatTile
              label="Delivered sales"
              value={money(data.deliveredSales)}
              hint={`${data.orderCount} orders in total`}
              tone="primary"
            />
            <StatTile
              label="In transit"
              value={money(data.inTransitSales)}
              hint="Shipped but not delivered"
            />
            <StatTile label="Paid out" value={money(data.paidOut)} hint="Completed payouts" />
            <StatTile
              label="Pending payouts"
              value={money(data.pendingPayouts)}
              hint="Requested, not yet paid"
              tone={data.pendingPayouts > 0 ? 'warning' : 'default'}
            />
          </View>

          <Notice
            title="No stored balance"
            body="Vidnov settles payouts against delivered orders. This app does not display an available balance because the backend does not keep one — the four figures above are the real records."
          />

          <SectionHeader title="Payout methods" />
          <View style={styles.methodRow}>
            <Text style={styles.methodNumber}>{data.payoutMethods}</Text>
            <Muted>
              {data.payoutMethods === 0
                ? 'No payout method saved yet. Add one from your wallet on vidnov.com before requesting a payout.'
                : `${data.payoutMethods === 1 ? 'Method' : 'Methods'} on file. Account numbers are never sent to the app.`}
            </Muted>
          </View>

          <SectionHeader title="Payout history" />
          {data.payouts.length === 0 ? (
            <Muted>No payouts have been requested yet.</Muted>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {data.payouts.map((payout) => (
                <View key={payout.id} style={styles.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowTitle}>
                      {payout.method || 'Payout'}
                    </Text>
                    <Muted>{shortDate(payout.createdAt)}</Muted>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <Text style={styles.amount}>{money(payout.amount, payout.currency)}</Text>
                    <Badge
                      label={titleCase(payout.status)}
                      tone={
                        ['paid', 'completed', 'approved'].includes(payout.status)
                          ? 'success'
                          : ['rejected', 'failed'].includes(payout.status)
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  methodNumber: { color: colors.text, fontSize: 26, fontWeight: '900' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  rowTitle: { color: colors.text, ...type.bodyStrong },
  amount: { color: colors.text, ...type.bodyStrong, fontWeight: '800' },
});
