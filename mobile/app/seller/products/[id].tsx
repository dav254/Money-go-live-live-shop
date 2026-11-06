import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ListingForm } from '../../../src/components/seller/listing-form';
import { SellerHeader } from '../../../src/components/seller/seller-header';
import { ErrorState, Loading, Notice, Screen } from '../../../src/components/ui';
import { RequireAuth } from '../../../src/components/require-auth';
import { seller } from '../../../src/lib/api';
import { useAuthedResource } from '../../../src/lib/use-authed';
import { colors, spacing } from '../../../src/theme';

/**
 * EDIT A LISTING.
 *
 * Reads the seller's own catalogue (never a public projection) so the form is
 * pre-filled with the real document — stock, was-price, delivery notes and
 * thumbnail arrays included. The server re-checks ownership on the write, so a
 * tampered id cannot edit somebody else's listing.
 */
export default function EditListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listingId = String(id ?? '');

  const { data, loading, error, reload } = useAuthedResource(
    (token) => seller.products(token),
    [listingId],
    { enabled: Boolean(listingId) },
  );

  const product = useMemo(() => {
    const list = (data?.products ?? []) as any[];
    return list.find((item) => String(item.id) === listingId) ?? null;
  }, [data?.products, listingId]);

  return (
    <RequireAuth>
      <Screen>
        <SellerHeader title="Edit listing" subtitle={product?.name || 'Your listing'} showBack />
        {loading && !data ? (
          <Loading label="Loading your listing…" />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !product ? (
          <Notice
            tone="warning"
            title="Listing not found"
            body="It may have been deleted, or it belongs to a different account. Go back to your catalogue and try again."
          />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ListingForm product={product} />
          </ScrollView>
        )}
      </Screen>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, backgroundColor: colors.background },
});
