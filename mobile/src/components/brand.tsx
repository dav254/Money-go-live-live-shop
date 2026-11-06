import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius } from '../theme';

/**
 * VIDNOV brand marks.
 *
 * The app ships no web logo file and must not fetch one to draw its own
 * welcome screen, so the mark is drawn natively: a Vidnov-red tile with the
 * signal glyph plus a spaced wordmark. It matches the website's black/red
 * identity without embedding a bitmap that would blur on a large phone.
 */
export function VidnovMark({ size = 56 }: { size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size * 0.28 },
      ]}
      accessibilityRole="image"
      accessibilityLabel="Vidnov"
    >
      <Ionicons name="flash" size={size * 0.46} color={colors.white} />
    </View>
  );
}

export function VidnovWordmark({ size = 26 }: { size?: number }) {
  return (
    <Text style={[styles.wordmark, { fontSize: size }]} accessibilityRole="header">
      VIDNOV
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  wordmark: {
    color: colors.white,
    fontWeight: '900',
    letterSpacing: 5,
  },
});
