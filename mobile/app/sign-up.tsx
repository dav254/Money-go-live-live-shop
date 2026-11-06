import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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
import { PRIVACY_URL, TERMS_URL } from '../src/lib/config';
import {
  clean,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
  validatePhone,
} from '../src/lib/validation';
import { colors, radius, spacing, type } from '../src/theme';

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirm' | 'terms', string>>;

/**
 * CREATE ACCOUNT.
 *
 * Everything is validated before a request leaves the phone, every server
 * rejection is shown verbatim (never replaced with "account created"), and the
 * password is only ever held in this component's state and the request body —
 * the session the server returns is what gets stored, in the Keystore.
 */
export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);

  const validate = (): boolean => {
    const next: Errors = {};
    const nameError = validateName(name);
    if (nameError) next.name = nameError;
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    const phoneError = validatePhone(phone);
    if (phoneError) next.phone = phoneError;
    const passwordError = validatePassword(password);
    if (passwordError) next.password = passwordError;
    const confirmError = validatePasswordConfirmation(password, confirm);
    if (confirmError) next.confirm = confirmError;
    if (!accepted) next.terms = 'Please accept the terms to continue.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy) return;
    setFailure(null);
    if (!validate()) return;

    setBusy(true);
    try {
      // The account starts as a buyer. The next screen records the sell/buy
      // choice, so nobody is pushed into a seller role they did not ask for.
      await signUp({
        email: clean(email).toLowerCase(),
        password,
        name: clean(name),
        phone: clean(phone) || undefined,
        role: 'buyer',
      });
      router.replace('/onboarding/role');
    } catch (thrown) {
      setFailure(messageFor(thrown));
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
          <Muted>One account for shopping, selling and growing your business.</Muted>
        </View>

        <View style={styles.form}>
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            error={errors.name}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
          />
          <Field
            label="Phone number (optional)"
            value={phone}
            onChangeText={setPhone}
            placeholder="+254 700 000 000"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            error={errors.phone}
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
                error={errors.password}
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

          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it once more"
            secureTextEntry={!reveal}
            autoComplete="new-password"
            textContentType="newPassword"
            error={errors.confirm}
          />

          <Pressable
            onPress={() => setAccepted((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            style={styles.termsRow}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
              {accepted ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to Vidnov&apos;s{' '}
              <Text style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
                terms of service
              </Text>{' '}
              and{' '}
              <Text style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                privacy policy
              </Text>
              .
            </Text>
          </Pressable>
          {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

          {failure ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{failure}</Text>
            </View>
          ) : null}

          <Button label="Create account" onPress={submit} loading={busy} disabled={busy} />
        </View>

        <View style={styles.footer}>
          <Muted>Already have an account?</Muted>
          <Button label="Sign in" variant="outline" onPress={() => router.replace('/sign-in')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxl * 2 },
  header: { gap: spacing.xs, marginTop: spacing.md },
  form: { gap: spacing.lg },
  label: { color: colors.textMuted, ...type.caption },
  passwordRow: { flexDirection: 'row', alignItems: 'flex-start' },
  passwordInput: { flex: 1, paddingRight: 44 },
  reveal: { position: 'absolute', right: spacing.md, height: 46, justifyContent: 'center' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { color: colors.textMuted, ...type.caption, flex: 1, lineHeight: 18 },
  link: { color: colors.primary, fontWeight: '700' },
  fieldError: { color: colors.danger, ...type.caption },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
  footer: { gap: spacing.sm, marginTop: spacing.md },
});
