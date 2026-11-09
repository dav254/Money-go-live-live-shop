import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RequireAuth } from '../src/components/require-auth';
import { RemoteImage } from '../src/components/remote-image';
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Notice,
  Screen,
  ScrollScreen,
  SectionHeader,
} from '../src/components/ui';
import { cart } from '../src/lib/api';
import { useAuthedResource } from '../src/lib/use-authed';
import { money } from '../src/lib/format';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * CART (buyer) — a read of `/api/cart`, the same document the website's cart
 * screen reads (`userProfiles/{uid}/cart`, VPS copy first).
 *
 * READ-ONLY, and the screen says so. There is no cart-write route: the website
 * changes quantities and creates the order from the browser, straight against
 * Firestore. A native +/- control would need a backend that does not exist, so
 * this screen answers "what is in my cart and what does it cost" honestly
 * rather than offering buttons that cannot work.
 *
 * Nothing is stored locally: the server's lines are the cart.
 */
export default function CartScreen() {
  return (
    <RequireAuth>
      <Cart />
    </RequireAuth>
  );
}

function Cart() {
  const router = useRouter();
  const { data, loading, error, reload } = useAuthedResource((token) => cart.list(token), []);

  const items = data?.items ?? [];
  const currency = items.find((line) => line.currency)?.currency ?? 'KES';
  const total = items.reduce(
    (sum, line) => sum + (Number(line.price) || 0) * (Number(line.quantity) || 1),
    0,
  );
  const count = items.reduce((sum, line) => sum + (Number(line.quantity) || 1), 0);

  if (loading && !data) {
    return (
      <Screen>
        <Loading label="Reading your cart…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          body="Anything you add on vidnov.com appears here. Adding from the app waits on a cart-write endpoint."
          action={<Button label="Browse listings" onPress={() => router.push('/discover')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollScreen>
        <View style={styles.summary}>
          <Text style={styles.eyebrow}>IN YOUR CART</Text>
          <Text style={styles.total}>{money(total, currency)}</Text>
          <Muted>
            {count} {count === 1 ? 'item' : 'items'}
            {data?.source === 'vps' ? ' · from the Vidnov store' : ''}
          </Muted>
        </View>

        <SectionHeader title="Lines" />
        {items.map((line) => {
          const quantity = Number(line.quantity) || 1;
          const lineTotal = (Number(line.price) || 0) * quantity;
          return (
            <View key={line.id} style={styles.row}>
              <View style={styles.thumb}>
                <RemoteImage
                  source={line.imageUrl}
                  style={styles.thumbImage}
                  radius={radius.sm}
                  label={line.name || line.title || 'Listing'}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {line.name || line.title || 'Listing'}
                </Text>
                <Muted style={{ fontSize: 11 }}>
                  {money(Number(line.price) || 0, line.currency ?? currency)} × {quantity}
                </Muted>
              </View>
              <Text style={styles.lineTotal}>{money(lineTotal, line.currency ?? currency)}</Text>
            </View>
          );
        })}

        <Notice
          title="Editing happens on the website"
          body="Vidnov's cart lines are changed from vidnov.com, where checkout also runs. The app has no cart-write or order-create route yet, so it will not pretend to have one."
        />

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Ionicons name="receipt-outline" size={16} color={colors.textMuted} />
            <Text style={styles.footerText}>Order total</Text>
            <Text style={styles.footerTotal}>{money(total, currency)}</Text>
          </View>
          <Button
            label="Review my orders"
            icon="cube-outline"
            variant="outline"
            onPress={() => router.push('/orders')}
          />
        </View>
      </ScrollScreen>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  eyebrow: { color: colors.textFaint, ...type.caption, fontWeight: '700', letterSpacing: 1.2 },
  total: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  thumbImage: { width: '100%', height: '100%' },
  name: { color: colors.text, ...type.bodyStrong },
  lineTotal: { color: colors.text, ...type.bodyStrong },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerText: { color: colors.textMuted, ...type.caption, flex: 1 },
  footerTotal: { color: colors.text, ...type.heading },
});
