import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { RequireAuth } from '../../src/components/require-auth';
import { Button, Field, Heading, Muted, Screen } from '../../src/components/ui';
import { messageFor, reviews } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * REVIEW AN ORDER.
 *
 * The website writes reviews through the same `POST /api/reviews`, and every
 * rule that matters is enforced there, not here: the order must be the
 * caller's, must be finished, and one review per direction per order. This
 * screen only collects the stars and the words, so a bug in the app can never
 * produce a review for someone else's order.
 */
const MAX_TEXT = 600;

export default function ReviewScreen() {
  return (
    <RequireAuth>
      <ReviewForm />
    </RequireAuth>
  );
}

function ReviewForm() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = !!orderId && rating > 0 && text.trim().length >= 3 && !busy;

  const submit = async () => {
    if (!orderId) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      await reviews.create(token, { orderId, rating, text: text.trim() });
      setDone(true);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View style={styles.done}>
          <View style={styles.doneIcon}>
            <Ionicons name="star" size={26} color={colors.primary} />
          </View>
          <Heading>Thanks for the review</Heading>
          <Muted style={{ textAlign: 'center' }}>
            It is now on the seller’s shop page and helps other buyers choose with confidence.
          </Muted>
          <Button label="Back to my orders" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.form}
      >
        <View style={{ gap: spacing.xs }}>
          <Heading>How did it go?</Heading>
          <Muted>
            Your review is public on the seller’s shop page. You can review each order once.
          </Muted>
        </View>

        <View style={styles.stars} accessibilityRole="adjustable">
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              accessibilityRole="button"
              accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
              accessibilityState={{ selected: rating >= value }}
              hitSlop={8}
            >
              <Ionicons
                name={rating >= value ? 'star' : 'star-outline'}
                size={38}
                color={rating >= value ? colors.primary : colors.textFaint}
              />
            </Pressable>
          ))}
        </View>

        <Field
          label="Your review"
          placeholder="What was the item, delivery and communication like?"
          value={text}
          onChangeText={(value) => setText(value.slice(0, MAX_TEXT))}
          multiline
          numberOfLines={6}
          style={styles.textArea}
          error={error}
        />

        <Muted style={styles.counter}>
          {text.trim().length}/{MAX_TEXT}
        </Muted>

        {rating === 0 ? <Muted>Pick a star rating to continue.</Muted> : null}

        <Button
          label={busy ? 'Sending…' : 'Post review'}
          onPress={submit}
          loading={busy}
          disabled={!canSubmit}
        />

        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.cancel}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.lg },
  stars: { flexDirection: 'row', gap: spacing.md },
  textArea: { minHeight: 140, textAlignVertical: 'top', paddingTop: spacing.md },
  counter: { alignSelf: 'flex-end' },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { color: colors.textFaint, ...type.caption, fontWeight: '700' },
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 77, 46, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
