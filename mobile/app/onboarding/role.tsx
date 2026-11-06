import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Display, Muted, Notice } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { messageFor } from '../../src/lib/api';
import { colors, radius, spacing, type } from '../../src/theme';

type Choice = 'seller' | 'buyer' | 'both';

/**
 * ROLE SELECTION — the fork in the road after registration.
 *
 * "Both" is the normal answer for a small business owner: they still shop on
 * Vidnov. Whatever is chosen here, the buyer account (orders, messages, saved
 * items) is untouched — the choice only records intent and unlocks the seller
 * tools. It can be changed later from the seller centre.
 */
export default function RoleSelectionScreen() {
  const router = useRouter();
  const { enableSelling } = useAuth();

  const [choice, setChoice] = useState<Choice>('both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proceed = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await enableSelling(choice);
      if (choice === 'buyer') router.replace('/(tabs)');
      else router.replace('/onboarding/business');
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Display>How will you use Vidnov?</Display>
        <Muted>
          This decides where the app opens for you. You can switch at any time —
          nothing is lost either way.
        </Muted>
      </View>

      <View style={styles.options}>
        <RoleCard
          active={choice === 'seller'}
          icon="storefront-outline"
          title="I want to sell"
          body="Set up a shop, list products or services and take orders."
          onPress={() => setChoice('seller')}
        />
        <RoleCard
          active={choice === 'buyer'}
          icon="bag-handle-outline"
          title="I want to buy"
          body="Discover shops, message sellers and track your orders."
          onPress={() => setChoice('buyer')}
        />
        <RoleCard
          active={choice === 'both'}
          icon="swap-horizontal-outline"
          title="I want to buy and sell"
          body="Run your business and keep shopping with the same account."
          onPress={() => setChoice('both')}
        />
      </View>

      <Notice
        title="One account, two sides"
        body="Becoming a seller does not create a second account. Your orders, chats and saved items stay exactly where they are."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label={choice === 'buyer' ? 'Start shopping' : 'Set up my shop'}
        onPress={proceed}
        loading={busy}
        disabled={busy}
      />

      <Pressable
        onPress={() => router.replace('/(tabs)')}
        accessibilityRole="button"
        accessibilityLabel="Decide later"
        style={styles.later}
      >
        <Text style={styles.laterText}>Decide later</Text>
      </Pressable>
    </ScrollView>
  );
}

function RoleCard({
  active,
  icon,
  title,
  body,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.card, active && styles.cardActive]}
    >
      <View style={[styles.icon, active && { backgroundColor: colors.primary }]}>
        <Ionicons name={icon} size={20} color={active ? colors.white : colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.cardTitle, active && { color: colors.primary }]}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={19}
        color={active ? colors.primary : colors.textFaint}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.sm, marginTop: spacing.md },
  options: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: colors.text, ...type.bodyStrong },
  cardBody: { color: colors.textFaint, ...type.caption, lineHeight: 17 },
  error: { color: colors.danger, ...type.caption },
  later: { alignItems: 'center', paddingVertical: spacing.md },
  laterText: { color: colors.textMuted, ...type.caption, fontWeight: '600' },
});
