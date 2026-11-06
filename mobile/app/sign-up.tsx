import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Display, Field, Muted } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { messageFor } from '../src/lib/api';
import { colors, radius, spacing, type } from '../src/theme';

type Role = 'buyer' | 'seller';

/**
 * CREATE ACCOUNT.
 *
 * The role is chosen here because it decides which section the account opens
 * into — the same choice the website's signup makes. The profile document is
 * written by the server (`POST /api/auth/profile`), so a dropped connection
 * after the Firebase account exists can be repaired on the next launch instead
 * of leaving a half-created account.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [role, setRole] = useState<Role>('buyer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);

    if (!name.trim()) return setError('Tell us your name.');
    if (!email.trim()) return setError('Enter your email address.');
    if (password.length < 8) return setError('Choose a password of at least 8 characters.');

    setBusy(true);
    try {
      await signUp({ email: email.trim(), password, name: name.trim(), role });
      router.replace('/(tabs)');
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Display>Join Vidnov</Display>
          <Muted>One account for shopping, selling and going live.</Muted>
        </View>

        <View style={styles.roles}>
          <RoleCard
            active={role === 'buyer'}
            icon="bag-handle-outline"
            title="I'm shopping"
            body="Buy products and services, message sellers, follow shops."
            onPress={() => setRole('buyer')}
          />
          <RoleCard
            active={role === 'seller'}
            icon="storefront-outline"
            title="I'm selling"
            body="List products or services, take orders, run live sales."
            onPress={() => setRole('seller')}
          />
        </View>

        <View style={styles.form}>
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoComplete="name"
            textContentType="name"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <Field
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry={!reveal}
                autoComplete="new-password"
                textContentType="newPassword"
                style={styles.passwordInput}
              />
              <Pressable
                onPress={() => setReveal((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
                hitSlop={8}
                style={styles.reveal}
              >
                <Ionicons
                  name={reveal ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button label="Create account" onPress={submit} loading={busy} />

          <Muted style={styles.terms}>
            By creating an account you agree to Vidnov&apos;s terms and privacy policy.
          </Muted>
        </View>

        <View style={styles.footer}>
          <Muted>Already have an account?</Muted>
          <Button label="Sign in" variant="outline" onPress={() => router.replace('/sign-in')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
      style={[styles.roleCard, active && styles.roleCardActive]}
    >
      <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.roleTitle, active && { color: colors.primary }]}>{title}</Text>
        <Text style={styles.roleBody}>{body}</Text>
      </View>
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        color={active ? colors.primary : colors.textFaint}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.xs, marginTop: spacing.md },
  roles: { gap: spacing.sm },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  roleTitle: { color: colors.text, ...type.bodyStrong },
  roleBody: { color: colors.textFaint, ...type.caption, marginTop: 2 },
  form: { gap: spacing.lg },
  label: { color: colors.textMuted, ...type.caption },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, paddingRight: 44 },
  reveal: { position: 'absolute', right: spacing.md, height: 46, justifyContent: 'center' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
  terms: { textAlign: 'center' },
  footer: { gap: spacing.sm, marginTop: spacing.md },
});
