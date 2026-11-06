import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ListingForm } from '../../../src/components/seller/listing-form';
import { SellerHeader } from '../../../src/components/seller/seller-header';
import { Screen } from '../../../src/components/ui';
import { RequireAuth } from '../../../src/components/require-auth';
import { colors, spacing } from '../../../src/theme';

/**
 * ADD A LISTING.
 *
 * The only screen that creates a product or service from the phone. Ownership
 * is stamped by the server from the verified token — the form never sends a
 * seller id, which is what makes a listing impossible to plant on another shop.
 */
export default function NewListingScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const listingType = type === 'service' ? 'service' : 'product';

  return (
    <RequireAuth>
      <Screen>
        <SellerHeader
          title={listingType === 'service' ? 'Add a service' : 'Add a product'}
          subtitle="Publish to your shop and discovery"
          showBack
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ListingForm listingType={listingType} />
        </ScrollView>
      </Screen>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    backgroundColor: colors.background,
  },
});
