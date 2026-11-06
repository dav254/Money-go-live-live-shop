import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../../src/components/remote-image';
import { ProductCard } from '../../src/components/product-card';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { catalog, seller } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useAuthedResource } from '../../src/lib/use-authed';
import { useResource } from '../../src/lib/use-resource';
import { colors, radius, spacing, type } from '../../src/theme';

type Tab = 'products' | 'services' | 'videos' | 'live' | 'about';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'products', label: 'Products' },
  { key: 'services', label: 'Services' },
  { key: 'videos', label: 'Videos' },
  { key: 'live', label: 'Live' },
  { key: 'about', label: 'About' },
];

/**
 * MY SHOP — the seller's storefront, exactly as buyers see it.
 *
 * The catalogue comes from the same public projection the buyer surfaces read
 * (`/api/mobile/catalog?sellerId=`), so a photo the seller just uploaded is the
 * photo on this page, on the shop page and in discovery. The header carries a
 * "buyer view" badge: this screen is a preview, not a private editor — editing
 * lives in shop settings.
 */
export default function MyShopScreen() {
  return (
    <RequireAuth>
      <MyShop />
    </RequireAuth>
  );
}

function MyShop() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('products');

  const shop = useAuthedResource((token) => seller.shop(token), []);
  const listings = useResource(
    () => catalog.shopListings(String(session?.uid ?? ''), 40),
    [session?.uid],
    { enabled: Boolean(session?.uid) },
  );
  const live = useResource(() => catalog.liveNow(), []);

  const record = shop.data?.shop ?? null;
  const all = (listings.data?.listings ?? []) as any[];
  const products = all.filter((item) => item.listingType !== 'service');
  const services = all.filter((item) => item.listingType === 'service');
  const myRooms = (live.data?.rooms ?? []).filter((room) => room.sellerId === session?.uid);

  const socialLinks = useMemo(() => record?.socialLinks ?? [], [record?.socialLinks]);

  if (shop.loading && !shop.data && !record) {
    return (
      <Screen>
        <SellerHeader title="My shop" showBack />
        <Loading label="Opening your storefront…" />
      </Screen>
    );
  }

  if (shop.error && !record) {
    return (
      <Screen>
        <SellerHeader title="My shop" showBack />
        <ErrorState message={shop.error} onRetry={shop.reload} />
      </Screen>
    );
  }

  if (!record?.shopName) {
    return (
      <Screen>
        <SellerHeader title="My shop" showBack />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState
            icon="storefront-outline"
            title="Your shop is not set up yet"
            body="Add your business details, logo and a cover photo to open your storefront."
            action={
              <Button
                label="Set up my shop"
                onPress={() => router.push('/onboarding/business')}
              />
            }
          />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader
        title="My shop"
        subtitle="What buyers see"
        showBack
        right={<Badge label="Buyer view" tone="primary" />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={shop.loading || listings.loading}
            tintColor={colors.primary}
            colors={[colors.primary]}
            onRefresh={() => {
              shop.reload();
              listings.reload();
              live.reload();
            }}
          />
        }
      >
        <View style={styles.coverWrap}>
          <RemoteImage
            source={record.bannerUrl || record.logoUrl}
            style={styles.cover}
            label="Shop cover photo"
          />
          <View style={styles.identity}>
            <RemoteImage
              source={record.logoUrl || profile?.profilePictureUrl}
              style={styles.logo}
              radius={radius.lg}
              label="Shop logo"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Heading>{record.shopName}</Heading>
              <Muted>
                {record.category}
                {record.cityTown ? ` · ${record.cityTown}` : ''}
              </Muted>
              <View style={styles.badges}>
                <Badge
                  label={record.published ? 'Published' : 'Draft'}
                  tone={record.published ? 'success' : 'warning'}
                />
                {record.offersDelivery ? <Badge label="Delivery" /> : null}
                {record.offersPickup ? <Badge label="Pickup" /> : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.shopActions}>
          <Button
            label="Edit shop"
            variant="outline"
            icon="create-outline"
            onPress={() => router.push('/seller/settings')}
            style={{ flex: 1 }}
          />
          <Button
            label="Public page"
            icon="open-outline"
            onPress={() => router.push(`/shop/${session?.uid ?? ''}`)}
            style={{ flex: 1 }}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.key }}
              style={[styles.tab, tab === item.key && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, tab === item.key && { color: colors.primary }]}>
                {item.label}
              </Text>
              {item.key === 'products' ? (
                <Text style={styles.tabCount}>{products.length}</Text>
              ) : null}
              {item.key === 'services' ? (
                <Text style={styles.tabCount}>{services.length}</Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>

        {tab === 'products' || tab === 'services' ? (
          listings.loading && !listings.data ? (
            <Loading label="Loading your catalogue…" />
          ) : listings.error ? (
            <ErrorState message={listings.error} onRetry={listings.reload} />
          ) : (tab === 'products' ? products : services).length === 0 ? (
            <EmptyState
              icon={tab === 'services' ? 'construct-outline' : 'cube-outline'}
              title={tab === 'services' ? 'No services yet' : 'No products yet'}
              body={
                tab === 'services'
                  ? 'Add a service so buyers can see what you do and ask for a quote.'
                  : 'Add a product and it appears here the moment it is published.'
              }
              action={
                <Button
                  label={tab === 'services' ? 'Add a service' : 'Add a product'}
                  onPress={() =>
                    router.push(
                      tab === 'services' ? '/seller/products/new?type=service' : '/seller/products/new',
                    )
                  }
                />
              }
            />
          ) : (
            <View style={styles.grid}>
              {(tab === 'products' ? products : services).map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <ProductCard product={item} />
                </View>
              ))}
            </View>
          )
        ) : null}

        {tab === 'videos' ? (
          <Notice
            tone="warning"
            title="Video posts are not published from this app yet"
            body="The upload pipeline and publishing endpoint for seller video posts are not part of this build. Nothing is shown here rather than a placeholder reel with invented views."
          />
        ) : null}

        {tab === 'live' ? (
          live.loading && !live.data ? (
            <Loading label="Checking your live status…" />
          ) : myRooms.length === 0 ? (
            <EmptyState
              icon="radio-outline"
              title="You are not live"
              body="When you start a live session it appears here and in Vidnov's live strip."
              action={
                <Button label="Live selling" onPress={() => router.push('/seller/live')} />
              }
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {myRooms.map((room) => (
                <View key={room.id} style={styles.liveRow}>
                  <Badge label="LIVE" tone="primary" />
                  <Text numberOfLines={1} style={styles.liveTitle}>
                    {room.title}
                  </Text>
                  <Muted>{room.viewerCount ?? 0} watching</Muted>
                </View>
              ))}
            </View>
          )
        ) : null}

        {tab === 'about' ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="About" />
            <Text style={styles.about}>{record.description || 'No description yet.'}</Text>

            <View style={styles.aboutRows}>
              {record.location ? <Line icon="location-outline" text={record.location} /> : null}
              {record.operatingHours ? (
                <Line icon="time-outline" text={record.operatingHours} />
              ) : null}
              {record.phoneNumber ? (
                <Line icon="call-outline" text={record.phoneNumber} />
              ) : null}
              {record.businessEmail ? (
                <Line icon="mail-outline" text={record.businessEmail} />
              ) : null}
              {record.serviceAreas ? (
                <Line icon="map-outline" text={record.serviceAreas} />
              ) : null}
            </View>

            {socialLinks.length ? (
              <View style={styles.links}>
                {socialLinks.map((link) => (
                  <Badge key={link.url} label={link.label} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  coverWrap: { backgroundColor: colors.surface },
  cover: { width: '100%', height: 130, borderRadius: 0 },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  logo: { width: 62, height: 62, marginTop: -32, borderWidth: 2, borderColor: colors.background },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 },
  shopActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  tabs: { gap: spacing.xs, paddingHorizontal: spacing.lg },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tabLabel: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
  tabCount: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  gridItem: { width: '47%' },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  liveTitle: { color: colors.text, ...type.bodyStrong, flex: 1 },
  about: { color: colors.textMuted, ...type.body, lineHeight: 22, paddingHorizontal: spacing.lg },
  aboutRows: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineText: { color: colors.text, ...type.body, flex: 1 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg },
});
