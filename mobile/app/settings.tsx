import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { Button, Field, ListRow, Muted, Screen, SectionHeader } from '../src/components/ui';
import { RequireAuth } from '../src/components/require-auth';
import { account, messageFor } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../src/lib/config';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * SETTINGS.
 *
 * Privacy policy, terms and support open in the system browser — those are
 * external legal/support resources, which is the one category of link a app may
 * legitimately hand off. Every in-app function stays in the app.
 *
 * Account deletion: Vidnov accounts carry orders, payouts and disputes, so the
 * app records a dated deletion request (server-side) rather than erasing live
 * financial records instantly. The screen says exactly that instead of showing a
 * button that quietly does nothing.
 */
export default function SettingsScreen() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const { profile, signOut, getToken } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const androidVersionCode =
    (Constants.expoConfig?.android as { versionCode?: number } | undefined)?.versionCode ?? 1;

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError('Could not open that link.');
    }
  };

  const requestDeletion = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const token = await getToken();
      const result = await account.requestDeletion(token, reason.trim() || undefined);
      setNotice(result.message);
      setReason('');
    } catch (thrown) {
      setError(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title="Legal & privacy" />
        <View style={styles.group}>
          <ListRow
            icon="shield-checkmark-outline"
            title="Privacy policy"
            detail="How Vidnov handles your data"
            onPress={() => openLink(PRIVACY_URL)}
          />
          <ListRow
            icon="document-text-outline"
            title="Terms of service"
            onPress={() => openLink(TERMS_URL)}
          />
          <ListRow
            icon="help-buoy-outline"
            title="Contact support"
            detail={SUPPORT_EMAIL}
            onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`)}
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.group}>
          <ListRow
            icon="phone-portrait-outline"
            title="Vidnov for Android"
            detail={`Version ${version} (build ${androidVersionCode}) · package com.vidnov.app`}
          />
          <ListRow
            icon="globe-outline"
            title="Vidnov on the web"
            detail="vidnov.com — the full marketplace in a browser"
            onPress={() => openLink('https://vidnov.com')}
          />
        </View>

        <SectionHeader title="Your account" />
        <View style={styles.card}>
          <Muted>
            Signed in as {profile?.email || 'your Vidnov account'}. Deleting your account removes your
            profile, listings and messages. Orders, payouts and any open dispute have to be settled
            first, so the request is reviewed by support before anything is removed.
          </Muted>

          <Field
            label="Reason (optional)"
            value={reason}
            onChangeText={setReason}
            placeholder="Tell us why you're leaving"
            multiline
            numberOfLines={3}
            style={styles.textarea}
          />

          {notice ? (
            <View style={styles.notice}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label="Request account deletion"
            variant="outline"
            icon="trash-outline"
            loading={busy}
            onPress={() =>
              Alert.alert(
                'Request account deletion?',
                'Support will review the request and email you before anything is removed.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Request deletion', style: 'destructive', onPress: requestDeletion },
                ],
              )
            }
          />
        </View>

        <Button
          label="Sign out"
          variant="ghost"
          icon="log-out-outline"
          onPress={async () => {
            await signOut();
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  group: { gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  textarea: { minHeight: 84, textAlignVertical: 'top', paddingTop: spacing.md },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(47, 191, 113, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { color: colors.success, ...type.caption, flex: 1 },
  error: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
});
