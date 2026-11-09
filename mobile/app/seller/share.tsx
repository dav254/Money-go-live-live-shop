import React from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Button,
  Card,
  ErrorState,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { useAuth } from '../../src/lib/auth';
import { seller } from '../../src/lib/api';
import { API_BASE_URL } from '../../src/lib/config';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SHARE & QR — the seller's public shop link, in one place.
 *
 * The link is the same canonical address every other surface uses —
 * `${API_BASE_URL}/sellers/{uid}` — so a link shared from the app opens the
 * same storefront a link shared from the website does. Nothing here is a
 * generated short code or a per-platform URL that could drift.
 *
 * The QR is deliberately NOT drawn on the device. A real, scannable QR needs a
 * QR encoder, and the one the website already uses with the canonical origin
 * (`/app/seller/share`) is the correct implementation to keep. This screen says
 * so and opens it, instead of shipping a second encoder that could encode a
 * different host.
 */
export default function SellerShareScreen() {
  return (
    <RequireAuth>
      <ShareShop />
    </RequireAuth>
  );
}

// Deliberately not called `Share`: the module already imports React Native's
// `Share` sheet, and a local component of the same name would shadow it.
function ShareShop() {
  const { session } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => seller.shop(token), []);

  const router = useRouter();
  const sellerId = session?.uid ?? '';
  const shopLink = sellerId ? `${API_BASE_URL}/sellers/${sellerId}` : '';
  const shopName = data?.shop?.shopName || 'My shop';

  const shareLink = async () => {
    if (!shopLink) return;
    try {
      await Share.share({
        title: shopName,
        message: `${shopName} on Vidnov — ${shopLink}`,
        // Android ignores `url` and uses `message`, iOS reads both; the message
        // already carries the link so one shape works everywhere.
      });
    } catch {
      // A dismissed share sheet is not an error worth reporting.
    }
  };

  return (
    <Screen>
      <SellerHeader title="Share & QR" subtitle="Get buyers to your shop" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {loading && !data ? <Loading label="Reading your shop…" /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}

        <Card style={styles.linkCard}>
          <View style={styles.linkHeader}>
            <Ionicons name="link-outline" size={18} color={colors.primary} />
            <Text style={styles.linkTitle}>{shopName}</Text>
          </View>
          <Text selectable style={styles.link} numberOfLines={2}>
            {shopLink || 'Sign in to get your shop link.'}
          </Text>
          <Muted>Long-press the link to copy it. It opens the same storefront on any device.</Muted>
        </Card>

        <Button
          label="Share your shop link"
          icon="share-social-outline"
          onPress={shareLink}
          disabled={!shopLink}
        />

        <SectionHeader title="QR code" />
        <Notice
          title="Printed QR lives on the website"
          body="The scannable QR for this shop is generated on vidnov.com from the same link above, so a code printed today keeps working. Opening it here uses your browser — the app does not draw a second code that could point somewhere else."
        />
        <Button
          label="Open my QR code"
          variant="outline"
          icon="qr-code-outline"
          onPress={() => void Linking.openURL(`${API_BASE_URL}/app/seller/share`)}
        />
        <Button
          label="Preview my shop"
          variant="ghost"
          icon="storefront-outline"
          onPress={() => router.push(`/shop/${sellerId}`)}
          disabled={!sellerId}
        />

        <Muted style={styles.footnote}>
          Followers who tap the link land on your public shop page — the same page buyers reach from
          Nearby and from search.
        </Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  linkCard: { gap: spacing.sm, borderRadius: radius.md },
  linkHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkTitle: { color: colors.text, ...type.bodyStrong },
  link: { color: colors.text, ...type.body, textDecorationLine: 'underline' },
  footnote: { marginTop: spacing.sm },
});
