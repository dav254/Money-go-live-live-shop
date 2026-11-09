import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../remote-image';
import {
  discover,
  messageFor,
  type DiscoverBusinessItem,
  type DiscoverItem,
  type DiscoverKind,
  type DiscoverListingItem,
  type DiscoverPage,
  type DiscoverSort,
} from '../../lib/api';
import { priceLabel } from '../../lib/discovery';
import { useDebounced } from '../../lib/use-resource';
import { fonts, premium, radius, spacing } from '../../theme';
import type { ThemeSeed } from '../../lib/discovery';

/**
 * DISCOVERY · SHOP.
 *
 * A thin client over `GET /api/discover` — the server query the website's Shop
 * panel already calls — so ranking, eligibility and paging are identical in
 * both places and no second catalogue exists. Filter changes debounce because
 * the route is rate limited, and a newer request always wins over a slow one.
 *
 * Price ordering and the price band are applied to the page that came back,
 * because the server query does not accept them; the line above the results
 * says so rather than implying a global price filter.
 */

type PriceSort = 'none' | 'asc' | 'desc';

const KINDS: Array<{ id: DiscoverKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'listings', label: 'Products & services' },
  { id: 'businesses', label: 'Businesses' },
];

const SORTS: Array<{ id: DiscoverSort; label: string }> = [
  { id: 'relevance', label: 'Recommended' },
  { id: 'newest', label: 'Newest' },
];

const CATEGORIES = [
  'Fashion & Apparel',
  'Electronics & Gadgets',
  'Home & Living',
  'Beauty & Personal Care',
  'Food & Groceries',
  'Health & Wellness',
  'Sports & Outdoors',
  'Automotive',
  'Baby & Kids',
  'Art & Collectibles',
];

export function DiscoveryShop({ query, seed }: { query: string; seed?: ThemeSeed }) {
  const router = useRouter();
  const [kind, setKind] = useState<DiscoverKind>(seed?.kind === 'service' ? 'listings' : 'all');
  const [category, setCategory] = useState<string | undefined>(seed?.category);
  const [location, setLocation] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<DiscoverSort>('relevance');
  const [priceSort, setPriceSort] = useState<PriceSort>('none');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [page, setPage] = useState<{ total: number; hasMore: boolean }>({ total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);

  const debouncedQuery = useDebounced(query, 350);
  const debouncedLocation = useDebounced(location, 350);

  useEffect(() => {
    setCategory(seed?.category);
    if (seed?.kind) setKind(seed.kind === 'service' ? 'listings' : 'all');
  }, [seed]);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const result: DiscoverPage = await discover.search({
          q: debouncedQuery,
          kind,
          category,
          location: debouncedLocation,
          availability: availableOnly ? 'available' : 'any',
          sort,
          page: nextPage,
          limit: 24,
        });
        setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
        setPage({ total: result.total, hasMore: result.hasMore });
      } catch (thrown) {
        setError(messageFor(thrown));
      } finally {
        setLoading(false);
      }
    },
    [availableOnly, category, debouncedLocation, debouncedQuery, kind, sort],
  );

  useEffect(() => {
    setPageNo(1);
    void load(1);
  }, [load]);

  const visible = useMemo(() => {
    const min = Number(minPrice.replace(/[^0-9.]/g, ''));
    const max = Number(maxPrice.replace(/[^0-9.]/g, ''));
    const hasMin = Number.isFinite(min) && min > 0;
    const hasMax = Number.isFinite(max) && max > 0;

    let rows = items;
    if (hasMin || hasMax) {
      rows = rows.filter((item) => {
        if (item.kind === 'business') return !hasMin && !hasMax;
        const amount = Number(item.localPrice ?? item.price ?? 0);
        if (!amount) return false;
        if (hasMin && amount < min) return false;
        if (hasMax && amount > max) return false;
        return true;
      });
    }
    if (priceSort !== 'none') {
      rows = [...rows].sort((a, b) => {
        const priceOf = (item: DiscoverItem) =>
          item.kind === 'business' ? Number.POSITIVE_INFINITY : Number(item.localPrice ?? item.price ?? 0) || Number.POSITIVE_INFINITY;
        const diff = priceOf(a) - priceOf(b);
        return priceSort === 'asc' ? diff : -diff;
      });
    }
    return rows;
  }, [items, maxPrice, minPrice, priceSort]);

  const activeFilters = [category, location, availableOnly ? 'available' : '', priceSort, minPrice || maxPrice ? 'price' : '']
    .filter(Boolean)
    .length;

  const reset = () => {
    setCategory(undefined);
    setLocation('');
    setAvailableOnly(false);
    setPriceSort('none');
    setMinPrice('');
    setMaxPrice('');
    setKind('all');
    setSort('relevance');
  };

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={16} color={premium.textMuted} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Filter by town or area"
            placeholderTextColor={premium.textMuted}
            style={styles.input}
            autoCorrect={false}
          />
          {location ? (
            <Pressable onPress={() => setLocation('')} hitSlop={8} accessibilityLabel="Clear area">
              <Ionicons name="close" size={15} color={premium.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setFiltersOpen((open) => !open)}
          style={[styles.filterButton, filtersOpen || activeFilters > 0 ? styles.filterButtonActive : null]}
          accessibilityRole="button"
          accessibilityLabel={activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'}
        >
          <Ionicons name="options-outline" size={17} color={premium.text} />
          {activeFilters > 0 ? <Text style={styles.filterCount}>{activeFilters}</Text> : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
      >
        {KINDS.map((option) => {
          const active = kind === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setKind(option.id)}
              style={[styles.chip, active ? styles.chipActive : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filtersOpen ? (
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>SORT</Text>
          <View style={styles.wrap}>
            {SORTS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => setSort(option.id)}
                style={[styles.chip, sort === option.id ? styles.chipActive : null]}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, sort === option.id ? styles.chipTextActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPriceSort(priceSort === 'asc' ? 'none' : 'asc')}
              style={[styles.chip, priceSort === 'asc' ? styles.chipActive : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, priceSort === 'asc' ? styles.chipTextActive : null]}>
                Price low → high
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPriceSort(priceSort === 'desc' ? 'none' : 'desc')}
              style={[styles.chip, priceSort === 'desc' ? styles.chipActive : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, priceSort === 'desc' ? styles.chipTextActive : null]}>
                Price high → low
              </Text>
            </Pressable>
          </View>

          <Text style={styles.panelLabel}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wrap}>
            <Pressable
              onPress={() => setCategory(undefined)}
              style={[styles.chip, !category ? styles.chipActive : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, !category ? styles.chipTextActive : null]}>Every category</Text>
            </Pressable>
            {CATEGORIES.map((option) => (
              <Pressable
                key={option}
                onPress={() => setCategory(option === category ? undefined : option)}
                style={[styles.chip, category === option ? styles.chipActive : null]}
                accessibilityRole="button"
              >
                <Text style={[styles.chipText, category === option ? styles.chipTextActive : null]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.panelLabel}>PRICE & AVAILABILITY</Text>
          <View style={styles.priceRow}>
            <TextInput
              value={minPrice}
              onChangeText={setMinPrice}
              placeholder="Min"
              placeholderTextColor={premium.textMuted}
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <Text style={styles.dash}>—</Text>
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              placeholder="Max"
              placeholderTextColor={premium.textMuted}
              keyboardType="numeric"
              style={styles.priceInput}
            />
            <Pressable
              onPress={() => setAvailableOnly((on) => !on)}
              style={[styles.chip, availableOnly ? styles.chipActive : null]}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, availableOnly ? styles.chipTextActive : null]}>
                Available now
              </Text>
            </Pressable>
          </View>

          <View style={styles.panelFooter}>
            <Text style={styles.panelHint}>
              Price ordering and the price band apply to the results loaded here; category, area and
              availability run on the server.
            </Text>
            <Pressable onPress={reset} accessibilityRole="button">
              <Text style={styles.reset}>Reset filters</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={premium.brand} />
          <Text style={styles.centerText}>Searching Vidnov…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={24} color={premium.textMuted} />
          <Text style={styles.centerTitle}>{error}</Text>
          <Pressable onPress={() => void load(1)} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.kind === 'business' ? (
              <BusinessCard item={item} onOpen={() => router.push(`/shop/${item.id}`)} />
            ) : (
              <ListingCard item={item} onOpen={() => router.push(`/listing/${item.id}`)} />
            )
          }
          ListHeaderComponent={
            <Text style={styles.count}>
              {page.total > 0
                ? `${page.total.toLocaleString()} ${page.total === 1 ? 'result' : 'results'}`
                : ''}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={24} color={premium.textMuted} />
              <Text style={styles.centerTitle}>Nothing matches yet</Text>
              <Text style={styles.centerText}>
                No seller has published a match for this combination. Try a wider category or a
                different area.
              </Text>
            </View>
          }
          ListFooterComponent={
            page.hasMore ? (
              <Pressable
                onPress={() => {
                  const next = pageNo + 1;
                  setPageNo(next);
                  void load(next);
                }}
                style={styles.more}
                accessibilityRole="button"
              >
                <Text style={styles.moreText}>{loading ? 'LOADING…' : 'LOAD MORE'}</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

function ListingCard({ item, onOpen }: { item: DiscoverListingItem; onOpen: () => void }) {
  const service = item.kind === 'service' || item.priceMode === 'quote';
  const label = priceLabel({
    id: item.id,
    localPrice: item.localPrice,
    price: item.price,
    localCurrency: item.localCurrency,
    priceMode: item.priceMode,
  });

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} — ${label}`}
    >
      <RemoteImage source={item.imageUrl} style={styles.cardImage} radius={0} showRetry={false} />
      {service ? (
        <View style={styles.cardTag}>
          <Text style={styles.cardTagText}>SERVICE</Text>
        </View>
      ) : null}
      {item.sponsored ? (
        <View style={styles.cardTag}>
          <Text style={styles.cardTagText}>SPONSORED</Text>
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardName}>
          {item.name}
        </Text>
        <Text style={styles.cardPrice}>{label}</Text>
        {item.sellerName ? (
          <Text numberOfLines={1} style={styles.cardSeller}>
            {item.sellerName}
          </Text>
        ) : null}
        {item.availabilityLabel ? (
          <Text style={[styles.cardMeta, !item.availableNow ? styles.cardMetaOff : null]}>
            {item.availabilityLabel}
          </Text>
        ) : null}
        <Pressable
          onPress={onOpen}
          style={styles.cardAction}
          accessibilityRole="button"
          accessibilityLabel={`Buy ${item.name}`}
        >
          <Text style={styles.cardActionText}>{service ? 'GET QUOTE' : 'BUY'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function BusinessCard({ item, onOpen }: { item: DiscoverBusinessItem; onOpen: () => void }) {
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} — open shop`}
    >
      <View style={styles.businessArt}>
        <RemoteImage source={item.logoUrl} style={styles.cardImage} radius={0} showRetry={false} />
        {item.verified ? (
          <View style={styles.cardTag}>
            <Text style={styles.cardTagText}>VERIFIED</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardName}>
          {item.name}
        </Text>
        {item.category ? <Text style={styles.cardMeta}>{item.category}</Text> : null}
        {item.location ? (
          <Text numberOfLines={1} style={styles.cardSeller}>
            {item.location}
          </Text>
        ) : null}
        {item.description ? (
          <Text numberOfLines={2} style={styles.cardMeta}>
            {item.description}
          </Text>
        ) : null}
        <Pressable
          onPress={onOpen}
          style={styles.cardAction}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.name}`}
        >
          <Text style={styles.cardActionText}>VIEW SHOP</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    color: premium.text,
    fontFamily: fonts.body,
    fontSize: 13,
    padding: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  filterButtonActive: { borderColor: premium.brand },
  filterCount: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 9, marginTop: 1 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    height: 30,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  chipActive: { backgroundColor: premium.brand, borderColor: premium.brand },
  chipText: { color: premium.textMuted, fontFamily: fonts.bodyMedium, fontSize: 11.5 },
  chipTextActive: { color: premium.text, fontFamily: fonts.bodySemi },
  panel: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    gap: spacing.sm,
  },
  panelLabel: {
    color: premium.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.6,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  priceInput: {
    width: 72,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
    backgroundColor: premium.background,
    color: premium.text,
    paddingHorizontal: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 12.5,
  },
  dash: { color: premium.textMuted, fontFamily: fonts.body },
  panelFooter: { gap: 4 },
  panelHint: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15 },
  reset: { color: premium.brand, fontFamily: fonts.bodySemi, fontSize: 11.5 },
  results: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  count: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 11.5, marginBottom: spacing.xs },
  card: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: premium.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: premium.border,
  },
  cardPressed: { borderColor: premium.brand },
  cardImage: { width: '100%', aspectRatio: 1 },
  businessArt: { position: 'relative' },
  cardTag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(16,16,16,0.78)',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  cardTagText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.9 },
  cardBody: { padding: spacing.md, gap: 3 },
  cardName: { color: premium.text, fontFamily: fonts.bodySemi, fontSize: 12.5, lineHeight: 17 },
  cardPrice: { color: premium.text, fontFamily: fonts.heading, fontSize: 14 },
  cardSeller: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 11 },
  cardMeta: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 10.5 },
  cardMetaOff: { color: premium.brand },
  cardAction: {
    marginTop: spacing.sm,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: premium.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1 },
  center: { paddingVertical: spacing.xxl, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  centerTitle: { color: premium.text, fontFamily: fonts.heading, fontSize: 15, textAlign: 'center' },
  centerText: { color: premium.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retry: {
    marginTop: spacing.sm,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: premium.brand,
    justifyContent: 'center',
  },
  retryText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 1 },
  more: {
    marginTop: spacing.md,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: premium.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { color: premium.text, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2 },
});
