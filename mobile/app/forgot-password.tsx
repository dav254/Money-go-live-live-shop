import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Display, Field, Muted } from '../src/components/ui';
import { useAuth } from '../src/lib/auth';
import { messageFor } from '../src/lib/api';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * RESET PASSWORD.
 *
 * Firebase sends the reset email — the app does not own a mailer and should not
 * pretend it does. The success copy is deliberately the same whether or not the
 * address exists, because telling a stranger "no account with that email" is an
 * account-enumeration oracle.
 */
export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim()) return setError('Enter your email address.');

    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.done}>
        <View style={styles.doneIcon}>
          <Ionicons name="mail-open-outline" size={26} color={colors.success} />
        </View>
        <Display>Check your inbox</Display>
        <Muted style={{ textAlign: 'center' }}>
          If {email.trim()} belongs to a Vidnov account, a reset link is on its way. The link
          expires in one hour.
        </Muted>
        <Button label="Back" variant="outline" onPress={() => setSent(false)} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Display>Reset your password</Display>
          <Muted>We&apos;ll email you a link to set a new one.</Muted>
        </View>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          onSubmitEditing={submit}
          returnKeyType="send"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Button label="Send reset link" onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.xs, marginTop: spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
  done: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  doneIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(47, 191, 113, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
