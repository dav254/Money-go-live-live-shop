import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Display, Field, Muted } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { messageFor } from '../src/lib/api';
import { validateEmail } from '../src/lib/validation';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * SIGN IN — native form, native validation, native session.
 *
 * The password is typed into a React Native TextInput and exchanged for a
 * Firebase ID token; only the token pair is stored (in the Android Keystore via
 * expo-secure-store). The password itself is never persisted anywhere.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);

    const emailProblem = validateEmail(email);
    if (emailProblem) return setError(emailProblem);
    if (!password) return setError('Enter your password.');

    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // This screen is a modal over the welcome page, so "back" would land on
      // the sign-in prompt again. Close the modal stack and open the product.
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
          <View style={styles.mark}>
            <Ionicons name="flash" size={22} color={colors.primary} />
          </View>
          <Display>Welcome back</Display>
          <Muted>Sign in to your Vidnov account. Buy, sell and go live.</Muted>
        </View>

        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <Field
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry={!reveal}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={submit}
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

          <Button label="Sign in" onPress={submit} loading={busy} />

          <Pressable onPress={() => router.push('/forgot-password')} hitSlop={8}>
            <Text style={styles.link}>Forgot your password?</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Muted>New to Vidnov?</Muted>
          <Button
            label="Create an account"
            variant="outline"
            onPress={() => router.replace('/sign-up')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.sm, marginTop: spacing.md },
  mark: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
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
  link: { color: colors.primary, ...type.caption, fontWeight: '700', textAlign: 'center' },
  footer: { gap: spacing.sm, marginTop: spacing.md },
});
