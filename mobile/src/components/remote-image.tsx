import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { apiUrl } from '../lib/config';
import { colors, radius, spacing } from '../theme';

/**
 * THE image component for Vidnov media.
 *
 * Why it exists: the server stores media as RELATIVE references
 * (`/api/media/file/...`). Handing that to an Android image component renders
 * nothing, which is how a listing that has photos ends up looking empty — the
 * exact bug this component prevents. Every image in the app goes through here
 * so the resolution rule lives in one place.
 *
 * It also does the three things a seller's connection demands:
 *   • a placeholder while the bytes arrive, so a card is never a blank hole;
 *   • a visible, retryable failure instead of a silent empty box;
 *   • disk + memory caching, so scrolling a catalogue does not re-download it.
 */
export function RemoteImage({
  source,
  style,
  contentFit = 'cover',
  transition = 180,
  label,
  radius: cornerRadius,
  showRetry = true,
}: {
  source?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  /** Accessibility label for the image (product name, shop name…). */
  label?: string;
  radius?: number;
  showRetry?: boolean;
}) {
  const uri = useMemo(() => apiUrl(source), [source]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(uri));
  const [attempt, setAttempt] = useState(0);

  if (!uri) {
    return (
      <View style={[styles.wrap, cornerRadius != null && { borderRadius: cornerRadius }, style]}>
        <Ionicons name="image-outline" size={24} color={colors.textFaint} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, cornerRadius != null && { borderRadius: cornerRadius }, style]}>
      <Image
        // A retry must not be served the broken cache entry, so the key and
        // cache policy change together.
        key={`${uri}-${attempt}`}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={failed ? 'none' : 'memory-disk'}
        accessible={Boolean(label)}
        accessibilityLabel={label}
        onLoadStart={() => setLoading(true)}
        onLoad={() => {
          setLoading(false);
          setFailed(false);
        }}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />

      {loading && !failed ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.textFaint} size="small" />
        </View>
      ) : null}

      {failed ? (
        <Pressable
          style={styles.overlay}
          disabled={!showRetry}
          onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          accessibilityRole={showRetry ? 'button' : undefined}
          accessibilityLabel={showRetry ? 'Retry loading image' : 'Image unavailable'}
        >
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,20,22,0.55)',
    gap: spacing.xs,
  },
});
