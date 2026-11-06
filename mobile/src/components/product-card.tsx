import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Badge, Price } from './ui';
import { colors, radius, spacing, type } from '../theme';
import type { Product } from '../lib/types';

/**
 * One listing in a native feed.
 *
 * Deliberately not the website's card rendered in a webview: this is a
 * Pressable RN component with its own image, price, stock and service badge,
 * and it navigates to a native detail screen.
 */
export function ProductCard({ product, width }: { product: Product; width?: number }) {
  const router = useRouter();
  const image = product.imageUrl || product.imageUrls?.[0];
  const isService = product.listingType === 'service';
  const outOfStock =
    product.availabilityState === 'out_of_stock' ||
    product.availabilityState === 'fully_booked' ||
    (product.stock != null && product.stock <= 0 && !isService);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={product.name ? `${product.name}${outOfStock ? ', sold out' : ''}` : 'Listing'}
      onPress={() => router.push(`/listing/${product.id}`)}
      style={({ pressed }) => [styles.card, width ? { width } : null, pressed && { opacity: 0.86 }]}
    >
      <View style={styles.media}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Ionicons name="image-outline" size={26} color={colors.textFaint} />
          </View>
        )}
        <View style={styles.mediaTop}>
          {isService ? <Badge label="Service" tone="primary" /> : null}
          {outOfStock ? <Badge label="Sold out" tone="warning" /> : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={styles.name}>
          {product.name || 'Untitled listing'}
        </Text>
        {product.priceMode === 'quote' ? (
          <Text style={styles.price}>Ask for a quote</Text>
        ) : (
          <Price amount={product.price ?? product.localPrice} currency={product.localCurrency} />
        )}
        {product.location || product.vendorLocation ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={colors.textFaint} />
            <Text numberOfLines={1} style={styles.location}>
              {product.location || product.vendorLocation}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  media: { aspectRatio: 1, backgroundColor: colors.surfaceRaised },
  mediaTop: { position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm, flexDirection: 'row', gap: spacing.xs },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.md, gap: 4 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  price: { color: colors.text, ...type.bodyStrong },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  location: { color: colors.textFaint, ...type.caption, flex: 1 },
});
