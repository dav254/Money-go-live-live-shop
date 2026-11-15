import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VidnovMark, VidnovWordmark } from '../src/components/brand';
import { RemoteImage } from '../src/components/remote-image';
import { Button, Price } from '../src/components/ui';
import { catalog } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { PRIVACY_URL, TERMS_URL } from '../src/lib/config';
import { PRODUCT_CATEGORIES } from '../src/lib/categories';
import { useResource } from '../src/lib/use-resource';
import { colors, fonts, HIT, radius, spacing } from '../src/theme';

/**
 * WELCOME — the first thing a new visitor sees on Android.
 *
 * The screen has one job: make the marketplace feel real and worth entering,
 * for buyers AND for sellers, without inventing a single fact.
 *
 * ## What is real here
 *
 * - Live rooms come from `GET /api/home/live` (PocketBase, Firestore fallback).
 *   The strip renders ONLY when that call returns sessions that are on air.
 * - The product rail comes from the same public `/api/search` the website's
 *   catalogue uses. When nothing is published yet, the section says so.
 * - Category chips use the marketplace's own category vocabulary and open
 *   Discovery with that search applied.
 *
 * Nothing on this screen is a seeded shop, a demo product, a review count or
 * an activity number: there is no placeholder inventory.
 *
 * ## Every action is wired
 *
 * Create account → `/sign-up` (carrying the seller intent when "sell" is
 * chosen), Sign in → `/sign-in`, Just browsing → the public buyer tabs, live
 * cards → the native live viewer, product cards → the native listing page,
 * category chips → Discovery filtered by that category, and the legal line
 * opens the real terms and privacy pages.
 *
 * ## Motion
 *
 * One mount animation (fade + 14px rise) on the hero, on the native driver. It
 * is skipped entirely when the system asks for reduced motion, so the screen is
 * still for people who want it still.
 */

type Journey = 'buyer' | 'seller';

/** A shop window needs a few categories, not the whole taxonomy. */
const FEATURED_CATEGORIES = PRODUCT_CATEGORIES.slice(0, 6);

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status } = useAuth();

  const signedIn = status === 'signedIn';
  const [journey, setJourney] = useState<Journey>('buyer');

  /**
   * Both reads are public and share the website's endpoints. They are the only
   * source of content on this screen; a failure simply hides the section.
   */
  const live = useResource(() => catalog.liveNow(), []);
  const fresh = useResource(() => catalog.search({ limit: 6 }), []);

  const rooms = useMemo(() => {
    const raw = live.data?.rooms;
    return Array.isArray(raw) ? raw.filter((room) => room && room.id) : [];
  }, [live.data]);

  const products = useMemo(() => {
    const raw = fresh.data?.products;
    return Array.isArray(raw) ? raw.filter((product) => product && product.id) : [];
  }, [fresh.data]);

  /* ── Motion ─────────────────────────────────────────────────────────────── */
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          rise.setValue(1);
          return;
        }
        Animated.timing(rise, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }).start();
      })
      .catch(() => {
        if (!cancelled) rise.setValue(1);
      });
    return () => {
      cancelled = true;
    };
  }, [rise]);

  const heroMotion = {
    opacity: rise,
    transform: [
      {
        translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
      },
    ],
  };

  /* ── Actions ────────────────────────────────────────────────────────────── */

  const browse = () => router.replace('/(tabs)');

  const createAccount = () => {
    if (signedIn) {
      browse();
      return;
    }
    if (journey === 'seller') {
      router.push({ pathname: '/sign-up', params: { intent: 'seller' } });
      return;
    }
    router.push('/sign-up');
  };

  const signIn = () => router.push('/sign-in');

  const openCategory = (category: string) =>
    router.replace({ pathname: '/(tabs)/discover', params: { q: category } });

  return (
    <View style={styles.screen}>
      {/* Brand light, drawn natively — no image asset to download. */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowSide} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Welcome to Vidnov"
      >
        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <Animated.View style={heroMotion}>
          <View style={styles.brandRow}>
            <VidnovMark size={44} />
            <View style={{ gap: 2 }}>
              <VidnovWordmark size={21} />
              <Text style={styles.tagline}>The marketplace that moves.</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>ONE ACCOUNT · TWO SIDES</Text>
            </View>

            <Text style={styles.headline}>
              More than a marketplace.{'\n'}
              <Text style={styles.headlineAccent}>
                Meet the people behind the products.
              </Text>
            </Text>

            <Text style={styles.lead}>
              Discover businesses, explore products, ask questions, watch live
              selling and connect directly with the people who sell.
            </Text>
          </View>
        </Animated.View>

        {/* ── Live now — only sessions that are genuinely on air ─────────── */}
        {rooms.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle
              title="Live now"
              actionLabel="See all"
              onAction={() => router.push('/live')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {rooms.map((room) => (
                <Pressable
                  key={room.id}
                  onPress={() =>
                    router.push({
                      pathname: '/live/[id]',
                      params: {
                        id: room.id,
                        sellerId: room.sellerId,
                        title: room.title ?? '',
                      },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Watch ${room.title || 'a live seller'} live, ${
                    room.viewerCount ?? 0
                  } watching`}
                  style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}
                >
                  <View style={styles.liveTop}>
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                    <Text style={styles.liveCount}>{room.viewerCount ?? 0} watching</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.liveTitle}>
                    {room.title || 'Live from a Vidnov seller'}
                  </Text>
                  <View style={styles.liveFoot}>
                    <Ionicons name="play-circle" size={17} color={colors.white} />
                    <Text style={styles.liveCta}>Watch</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Two sides, one account ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>CHOOSE YOUR SIDE</Text>

          <JourneyCard
            active={journey === 'buyer'}
            icon="bag-handle-outline"
            title="I'm here to buy"
            body="Discover real shops and products, watch live selling and talk to sellers before you buy."
            points={['Shops, products and services', 'Live selling and videos', 'Message sellers directly']}
            onPress={() => setJourney('buyer')}
          />

          <JourneyCard
            active={journey === 'seller'}
            icon="storefront-outline"
            title="I'm here to sell"
            body="Open a shop, publish what you offer and reach the customers already looking for it."
            points={['Open your shop in minutes', 'Publish products and services', 'Take orders and chat with buyers']}
            onPress={() => setJourney('seller')}
          />

          <Text style={styles.note}>
            One account covers both sides — selling never creates a second
            account, and your orders and chats stay where they are.
          </Text>
        </View>

        {/* ── Real catalogue, or an honest empty shelf ──────────────────── */}
        <View style={styles.section}>
          <SectionTitle
            title="Fresh on Vidnov"
            actionLabel={products.length > 0 ? 'Browse' : undefined}
            onAction={browse}
          />

          {products.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
            >
              {products.map((product) => (
                <Pressable
                  key={product.id}
                  onPress={() => router.push(`/listing/${product.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    product.name ? `Open ${product.name}` : 'Open listing'
                  }
                  style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
                >
                  <RemoteImage
                    source={product.imageUrl || product.imageUrls?.[0]}
                    style={styles.productImage}
                    radius={radius.md}
                    label={product.name ? `${product.name} photo` : 'Listing photo'}
                  />
                  <Text numberOfLines={2} style={styles.productName}>
                    {product.name || 'Untitled listing'}
                  </Text>
                  {
                    /* A local price is already in `localCurrency` — pairing a
                       converted `price` with it would misstate the amount. */
                  }
                  {product.priceMode === 'quote' ? (
                    <Text style={styles.productPrice}>Ask for a quote</Text>
                  ) : (
                    <Price
                      amount={product.localPrice ?? product.price}
                      currency={product.localCurrency}
                      style={styles.productPrice}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          ) : fresh.loading ? (
            <View style={styles.quiet}>
              <Text style={styles.quietText}>Opening the marketplace…</Text>
            </View>
          ) : fresh.error ? (
            /*
             * A failed read is never described as an empty marketplace: that
             * would misstate the truth about the seller's own shop.
             */
            <View style={styles.quiet}>
              <Ionicons name="cloud-offline-outline" size={18} color={colors.textFaint} />
              <Text style={styles.quietText}>
                We couldn&apos;t reach the marketplace just now. Everything else
                on this screen still works.
              </Text>
              <Pressable
                onPress={fresh.reload}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Try loading listings again"
              >
                <Text style={styles.quietRetry}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.quiet}>
              <Ionicons name="storefront-outline" size={18} color={colors.textFaint} />
              <Text style={styles.quietText}>
                Vidnov is just opening its doors. As sellers publish their shops,
                their real products appear here — we never show demo inventory.
              </Text>
            </View>
          )}
        </View>

        {/* ── Real categories, each one a working filter ────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>BROWSE CATEGORIES</Text>
          <View style={styles.chips}>
            {FEATURED_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                onPress={() => openCategory(category)}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${category}`}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipText}>{category}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={browse}
              accessibilityRole="button"
              accessibilityLabel="Browse the whole catalogue"
              style={({ pressed }) => [styles.chip, styles.chipAll, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, styles.chipAllText]}>All of Vidnov</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.legal}>
          By continuing you agree to Vidnov&apos;s{' '}
          <Text style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
            terms
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            privacy policy
          </Text>
          .
        </Text>
      </ScrollView>

      {/* ── Actions stay in thumb reach, above the system bar ───────────── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={
            signedIn
              ? 'Continue to Vidnov'
              : journey === 'seller'
                ? 'Create a seller account'
                : 'Create account'
          }
          icon={signedIn ? 'arrow-forward' : undefined}
          onPress={createAccount}
        />
        {!signedIn ? (
          <Button label="Sign in" variant="outline" onPress={signIn} />
        ) : null}
        <Pressable
          onPress={browse}
          accessibilityRole="button"
          accessibilityLabel="Just browsing — explore Vidnov without an account"
          style={styles.browse}
        >
          <Text style={styles.browseText}>Just browsing</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function SectionTitle({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function JourneyCard({
  active,
  icon,
  title,
  body,
  points,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  points: string[];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      /* `checked` is what a radio announces; `selected` keeps older readers. */
      accessibilityState={{ checked: active, selected: active }}
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [
        styles.journey,
        active && styles.journeyActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.journeyHead}>
        <View style={[styles.journeyIcon, active && styles.journeyIconActive]}>
          <Ionicons
            name={icon}
            size={20}
            color={active ? colors.white : colors.textMuted}
          />
        </View>
        <Text style={[styles.journeyTitle, active && { color: colors.white }]}>
          {title}
        </Text>
        <Ionicons
          name={active ? 'radio-button-on' : 'radio-button-off'}
          size={20}
          color={active ? colors.primary : colors.textFaint}
        />
      </View>

      <Text style={styles.journeyBody}>{body}</Text>

      <View style={styles.points}>
        {points.map((point) => (
          <View key={point} style={styles.pointRow}>
            <Ionicons
              name="checkmark"
              size={13}
              color={active ? colors.primary : colors.textFaint}
            />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },

  glowTop: {
    position: 'absolute',
    top: -170,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(255,77,46,0.17)',
  },
  glowSide: {
    position: 'absolute',
    top: 320,
    left: -160,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,77,46,0.06)',
  },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tagline: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  hero: { gap: spacing.md, marginTop: spacing.xxl },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 2,
  },
  headline: {
    color: colors.white,
    fontFamily: fonts.headingExtra,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.9,
  },
  headlineAccent: { color: colors.primary },
  lead: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 420,
  },

  section: { gap: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.white,
    fontFamily: fonts.heading,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  sectionAction: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
  },
  sectionEyebrow: {
    color: colors.textFaint,
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 1.8,
  },
  rail: { gap: spacing.md, paddingRight: spacing.xl },

  liveCard: {
    width: 196,
    minHeight: 140,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,77,46,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,77,46,0.42)',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.white },
  liveBadgeText: {
    color: colors.white,
    fontFamily: fonts.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
  },
  liveCount: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  liveTitle: {
    color: colors.white,
    fontFamily: fonts.heading,
    fontSize: 15,
    lineHeight: 20,
  },
  liveFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveCta: { color: colors.white, fontFamily: fonts.bodySemi, fontSize: 13 },

  journey: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  journeyActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,77,46,0.10)',
  },
  journeyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  journeyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyIconActive: { backgroundColor: colors.primary },
  journeyTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 16.5,
  },
  journeyBody: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13.5,
    lineHeight: 20,
  },
  points: { gap: 5, marginTop: 2 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pointText: {
    color: colors.textFaint,
    fontFamily: fonts.bodyMedium,
    fontSize: 12.5,
  },
  note: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },

  productCard: { width: 142, gap: spacing.sm },
  productImage: { width: 142, height: 142 },
  productName: {
    color: colors.text,
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
  },
  productPrice: { color: colors.primary, fontFamily: fonts.heading, fontSize: 14 },

  quiet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quietText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
  },
  quietRetry: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12.5,
    paddingVertical: 2,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipAll: { borderColor: 'rgba(255,77,46,0.45)', backgroundColor: 'rgba(255,77,46,0.10)' },
  chipText: { color: colors.textMuted, fontFamily: fonts.bodySemi, fontSize: 12.5 },
  chipAllText: { color: colors.white },

  legal: {
    color: colors.textFaint,
    fontFamily: fonts.body,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  link: { color: colors.primary, fontFamily: fonts.bodyBold },

  footer: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(10,10,11,0.98)',
  },
  browse: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: HIT,
  },
  browseText: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemi,
    fontSize: 14.5,
  },
  pressed: { opacity: 0.82 },
});
