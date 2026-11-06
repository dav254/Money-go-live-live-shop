import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ProductCard } from '../../src/components/product-card';
import { RemoteImage } from '../../src/components/remote-image';
import { Badge, Body, Display, ErrorState, Loading, Muted, Row, ScrollScreen, SectionHeader } from '../../src/components/ui';
import { catalog } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useResource } from '../../src/lib/use-resource';
import { colors, radius, spacing, type } from '../../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, status } = useAuth();
  const live = useResource(() => catalog.liveNow(), []);
  const featured = useResource(() => catalog.search({ limit: 20 }), []);

  const firstName = (profile?.fullName || '').trim().split(' ')[0];
  const isSeller = profile?.userRole === 'seller' || profile?.userRole === 'admin';
  const products = Array.isArray(featured.data?.products) ? featured.data!.products : [];

  return (
    <ScrollScreen refreshing={featured.loading || live.loading} onRefresh={() => { featured.reload(); live.reload(); }}>
      <View style={{ gap: spacing.xs }}>
        <Muted>{status === 'signedIn' && firstName ? `Welcome back, ${firstName}` : 'Discover Vidnov'}</Muted>
        <Display>Post. Earn. Repeat.</Display>
      </View>

      <Pressable onPress={() => router.push('/(tabs)/discover')} style={styles.searchBar} accessibilityRole="search">
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <Text style={styles.searchText}>Search products, services and shops</Text>
      </Pressable>

      <Row style={{ gap: spacing.sm }}>
        <QuickAction icon="pricetags-outline" label="Shop" onPress={() => router.push('/(tabs)/discover')} />
        <QuickAction icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
        <QuickAction icon="radio-outline" label="Live" onPress={() => router.push('/live')} />
        <QuickAction icon="sparkles-outline" label="AI Studio" onPress={() => router.push('/ai-studio')} />
      </Row>

      {isSeller ? (
        <Pressable onPress={() => router.push('/seller')} style={styles.sellerCard} accessibilityRole="button">
          <View style={styles.sellerIcon}>
            <Ionicons name="storefront-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sellerTitle}>Seller dashboard</Text>
            <Muted>Orders, offers and your shop, in the app.</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}

      <SectionHeader
        title="Live now"
        action={
          <Pressable onPress={() => router.push('/live')} hitSlop={8}>
            <Text style={styles.link}>See all</Text>
          </Pressable>
        }
      />

      {live.loading && !live.data ? (
        <Loading label="Finding live sellers…" />
      ) : live.error ? (
        <ErrorState message={live.error} onRetry={live.reload} />
      ) : (live.data?.rooms?.length ?? 0) === 0 ? (
        <View style={styles.quiet}>
          <Ionicons name="radio-outline" size={18} color={colors.textFaint} />
          <Muted>No seller is live right now. Check back soon.</Muted>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          {(live.data?.rooms ?? []).map((room: any) => (
            <Pressable
              key={room.id}
              onPress={() => router.push('/live')}
              style={styles.liveCard}
              accessibilityRole="button"
              accessibilityLabel={`${room.title}, ${room.viewerCount} watching`}
            >
              <RemoteImage
                source={room.image}
                style={[StyleSheet.absoluteFill, styles.liveImage]}
                radius={0}
                label={room.title ? `${room.title} preview` : 'Live session'}
              />
              <View style={styles.liveOverlay}>
                <Badge label="LIVE" tone="primary" />
                <Text numberOfLines={2} style={styles.liveTitle}>{room.title || 'Live session'}</Text>
                <Row style={{ gap: 4 }}>
                  <Ionicons name="eye-outline" size={12} color={colors.text} />
                  <Text style={styles.liveMeta}>{room.viewerCount ?? 0}</Text>
                </Row>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <SectionHeader
        title="Fresh on Vidnov"
        action={
          <Pressable onPress={() => router.push('/(tabs)/discover')} hitSlop={8}>
            <Text style={styles.link}>Browse</Text>
          </Pressable>
        }
      />

      {featured.loading && !featured.data ? (
        <Loading label="Loading listings…" />
      ) : featured.error ? (
        <ErrorState message={featured.error} onRetry={featured.reload} />
      ) : products.length === 0 ? (
        <Body>No listings have been published yet.</Body>
      ) : (
        <View style={styles.grid}>
          {products.map((product: any) => (
            <View key={product.id} style={styles.gridItem}>
              <ProductCard product={product} />
            </View>
          ))}
        </View>
      )}
    </ScrollScreen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quick} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
  },
  searchText: { color: colors.textFaint, ...type.body },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sellerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerTitle: { color: colors.text, ...type.bodyStrong },
  link: { color: colors.primary, ...type.caption, fontWeight: '700' },
  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  liveCard: { width: 210, height: 250, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  liveImage: { borderRadius: 0 },
  liveOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 6,
    padding: spacing.md,
    backgroundColor: 'rgba(10,10,11,0.35)',
  },
  liveTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  liveMeta: { color: colors.text, ...type.caption },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { width: '48%' },
});
