import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RemoteImage } from '../../src/components/remote-image';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Button,
  EmptyState,
  Loading,
  Muted,
  Notice,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { seller } from '../../src/lib/api';
import { API_BASE_URL } from '../../src/lib/config';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * VIDEOS & POSTS.
 *
 * What genuinely exists on this backend is video attached to a LISTING
 * (`videoUrl` on the product document), plus a separate seller video studio on
 * the website whose publishing endpoint this app does not call. So the screen
 * shows the real listing videos and states plainly that standalone post
 * publishing is not available from Android yet — it does not present a draft
 * composer that cannot upload.
 */
export default function SellerContentScreen() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  );
}

function Content() {
  const router = useRouter();
  const { data, loading } = useAuthedResource((token) => seller.products(token), []);

  const list = (data?.products ?? []) as any[];
  const withVideo = list.filter(
    (product) => Boolean(product.videoUrl) || (Array.isArray(product.videoUrls) && product.videoUrls.length),
  );

  return (
    <Screen>
      <SellerHeader title="Videos & posts" subtitle="Content on your shop" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <Notice
          tone="warning"
          title="Standalone posts are not published from this app yet"
          body="Vidnov's post/video publishing endpoint is not part of this build, so there is no composer here that would fail on upload. Videos attached to a listing already work and are listed below."
        />

        <SectionHeader title={`Listing videos (${withVideo.length})`} />
        {loading && !data ? (
          <Loading label="Checking your listings…" />
        ) : withVideo.length === 0 ? (
          <EmptyState
            icon="videocam-outline"
            title="No listing videos yet"
            body="Add a video to a listing from the web seller studio, or capture product photos here — both appear on your shop."
            action={
              <Button label="Manage listings" onPress={() => router.push('/seller/products')} />
            }
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {withVideo.map((product) => (
              <View key={product.id} style={styles.row}>
                <RemoteImage
                  source={product.imageUrl}
                  style={styles.thumb}
                  label={product.name ? `${product.name} thumbnail` : 'Listing thumbnail'}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {product.name || 'Untitled listing'}
                  </Text>
                  <Muted numberOfLines={1}>
                    {product.category || 'No category'} · video attached
                  </Muted>
                </View>
                <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
              </View>
            ))}
          </View>
        )}

        <Button
          label="Edit a listing"
          variant="outline"
          icon="create-outline"
          onPress={() => router.push('/seller/products')}
        />
        <Button
          label="Open the video studio on vidnov.com"
          variant="ghost"
          icon="open-outline"
          onPress={() => void Linking.openURL(`${API_BASE_URL}/app/seller/video-studio`)}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  thumb: { width: 56, height: 56 },
  name: { color: colors.text, ...type.bodyStrong },
});
