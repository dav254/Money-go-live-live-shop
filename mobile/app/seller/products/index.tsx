import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../../../src/components/remote-image';
import { SellerHeader } from '../../../src/components/seller/seller-header';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
} from '../../../src/components/ui';
import { RequireAuth } from '../../../src/components/require-auth';
import { messageFor, seller } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth';
import { money } from '../../../src/lib/format';
import { useAuthedResource } from '../../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../../src/theme';

type Filter = 'all' | 'products' | 'services' | 'out';

const PAGE_SIZE = 12;

/**
 * PRODUCTS & SERVICES — the seller's own catalogue.
 *
 * `/api/products/mine` returns the caller's listings (VPS first), and the
 * actions here are the real ones: view as a buyer, edit (the same form with the
 * document pre-filled) and delete (a tombstone, confirmed first). Search and
 * filters run on the fetched set — a shop with hundreds of listings is a later
 * problem; inventing a server search that does not exist would not fix it.
 */
export default function SellerProductsScreen() {
  return (
    <RequireAuth>
      <Products />
    </RequireAuth>
  );
}

function Products() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { data, loading, error, reload } = useAuthedResource((token) => seller.products(token), []);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const all = (data?.products ?? []) as any[];

  const items = useMemo(() => {
    const search = query.trim().toLowerCase();
    return all.filter((product) => {
      if (filter === 'products' && product.listingType === 'service') return false;
      if (filter === 'services' && product.listingType !== 'service') return false;
      if (filter === 'out') {
        const out =
          product.availabilityState === 'out_of_stock' ||
          (typeof product.stock === 'number' && product.stock <= 0 && product.listingType !== 'service');
        if (!out) return false;
      }
      if (search) {
        const haystack = `${product.name ?? ''} ${product.category ?? ''} ${product.tags ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [all, filter, query]);

  const shown = items.slice(0, visible);

  const confirmDelete = (product: any) => {
    Alert.alert(
      'Delete this listing?',
      `“${product.name || 'Untitled listing'}” will disappear from your shop and from discovery. Orders that already contain it are not affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void remove(product.id),
        },
      ],
    );
  };

  const remove = async (id: string) => {
    setBusyId(id);
    setFailure(null);
    try {
      const token = await getToken();
      await seller.deleteProduct(token, id);
      reload();
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <SellerHeader title="Products & services" showBack />
        <Loading label="Loading your catalogue…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <SellerHeader title="Products & services" showBack />
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SellerHeader
        title="Products & services"
        subtitle={`${all.length} ${all.length === 1 ? 'listing' : 'listings'}${data?.source === 'firestore' ? ' · backup store' : ''}`}
        showBack
        right={
          <Pressable
            onPress={() => router.push('/seller/products/new')}
            accessibilityRole="button"
            accessibilityLabel="Add a listing"
            hitSlop={10}
            style={styles.addButton}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </Pressable>
        }
      />

      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.textFaint} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search your listings"
                placeholderTextColor={colors.textFaint}
                style={styles.searchInput}
                autoCapitalize="none"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.chips}>
              {(
                [
                  ['all', 'All'],
                  ['products', 'Products'],
                  ['services', 'Services'],
                  ['out', 'Out of stock'],
                ] as const
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  active={filter === value}
                  onPress={() => {
                    setFilter(value);
                    setVisible(PAGE_SIZE);
                  }}
                />
              ))}
            </View>

            {failure ? (
              <View style={styles.failure}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                <Text style={styles.failureText}>{failure}</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isService = item.listingType === 'service';
          const outOfStock =
            item.availabilityState === 'out_of_stock' ||
            (typeof item.stock === 'number' && item.stock <= 0 && !isService);
          const unpublished = item.unpublished === true;

          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <Pressable
                  onPress={() => router.push(`/listing/${item.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.name || 'listing'} as a buyer`}
                >
                  <RemoteImage
                    source={item.imageUrl || item.imageUrls?.[0]}
                    style={styles.image}
                    label={item.name ? `${item.name} photo` : 'Listing photo'}
                  />
                </Pressable>

                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={2} style={styles.name}>
                    {item.name || 'Untitled listing'}
                  </Text>
                  <Text style={styles.price}>
                    {item.priceMode === 'quote'
                      ? 'Ask for a quote'
                      : money(item.price ?? item.localPrice, item.localCurrency)}
                  </Text>
                  <View style={styles.badges}>
                    <Badge
                      label={isService ? 'Service' : 'Product'}
                      tone={isService ? 'primary' : 'neutral'}
                    />
                    {unpublished ? <Badge label="Unpublished" tone="warning" /> : null}
                    {outOfStock ? <Badge label="Out of stock" tone="danger" /> : null}
                    {!unpublished && !outOfStock ? (
                      <Badge label="Published" tone="success" />
                    ) : null}
                  </View>
                  <Muted numberOfLines={1}>
                    {item.category || 'No category'}
                    {!isService && typeof item.stock === 'number' ? ` · ${item.stock} in stock` : ''}
                  </Muted>
                </View>
              </View>

              <View style={styles.actions}>
                <Action
                  icon="create-outline"
                  label="Edit"
                  onPress={() => router.push(`/seller/products/${item.id}`)}
                />
                <Action
                  icon="eye-outline"
                  label="View"
                  onPress={() => router.push(`/listing/${item.id}`)}
                />
                <Action
                  icon="trash-outline"
                  label="Delete"
                  tone="danger"
                  busy={busyId === String(item.id)}
                  onPress={() => confirmDelete(item)}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          all.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No listings yet"
              body="Publish your first product or service and it appears in your shop and in discovery immediately."
              action={
                <Button
                  label="Add a listing"
                  icon="add"
                  onPress={() => router.push('/seller/products/new')}
                />
              }
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title="Nothing matches"
              body="No listing matches that search or filter."
              action={<Chip label="Clear filters" active onPress={() => {
                setQuery('');
                setFilter('all');
              }} />}
            />
          )
        }
        ListFooterComponent={
          items.length > shown.length ? (
            <Button
              label={`Show more (${items.length - shown.length})`}
              variant="outline"
              onPress={() => setVisible((count) => count + PAGE_SIZE)}
            />
          ) : undefined
        }
      />
    </Screen>
  );
}

function Action({
  icon,
  label,
  onPress,
  tone = 'default',
  busy,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
    >
      <Ionicons
        name={busy ? 'hourglass-outline' : icon}
        size={16}
        color={tone === 'danger' ? colors.danger : colors.textMuted}
      />
      <Text style={[styles.actionLabel, tone === 'danger' && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.sm, marginBottom: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, ...type.body, paddingVertical: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  failure: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(240,68,56,0.12)',
  },
  failureText: { color: colors.danger, ...type.caption, flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  image: { width: 88, height: 88 },
  name: { color: colors.text, ...type.bodyStrong },
  price: { color: colors.text, ...type.body, fontWeight: '800' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  actionLabel: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
});
