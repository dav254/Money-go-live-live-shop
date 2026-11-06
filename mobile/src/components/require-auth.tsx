import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Loading, Muted, Screen } from './ui';
import { useAuth } from '../lib/auth';
import { colors, radius, spacing, type } from '../theme';

/**
 * Gate for screens that need an account.
 *
 * The app is browsable signed-out — discovery, listing pages and shops are
 * public in the product, exactly as they are on the website. Only the personal
 * surfaces (orders, messages, saved items, seller tools) sit behind this.
 *
 * Signed-out visitors get a real explanation and a sign-in route inside the
 * app. They are never bounced to a browser.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <Screen>
        <Loading label="Restoring your session…" />
      </Screen>
    );
  }

  if (status === 'signedOut') return <SignedOutPrompt />;

  return <>{children}</>;
}

export function SignedOutPrompt({
  title = 'Sign in to continue',
  body = 'This part of Vidnov belongs to your account. Sign in and everything you have saved, bought or listed is right here.',
}: {
  title?: string;
  body?: string;
}) {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.wrap}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed-outline" size={26} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Muted style={styles.body}>{body}</Muted>
        <Button label="Sign in" onPress={() => router.push('/sign-in')} style={styles.action} />
        <Button
          label="Create an account"
          variant="outline"
          onPress={() => router.push('/sign-up')}
          style={styles.action}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, ...type.title, textAlign: 'center' },
  body: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.xs },
});
