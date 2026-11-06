import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ImageManager } from '../../src/components/media/image-manager';
import { SellerHeader } from '../../src/components/seller/seller-header';
import {
  Avatar,
  Badge,
  Button,
  Field,
  Muted,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { RequireAuth } from '../../src/components/require-auth';
import { messageFor, seller } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { IMAGE_FOLDERS, storedRef, type LocalImage } from '../../src/lib/media';
import { clean, validateName, validatePhone } from '../../src/lib/validation';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * SELLER PROFILE — the person behind the shop.
 *
 * Name, phone, bio and avatar are editable here and saved to both stores. The
 * email is shown but read-only: it is the account's sign-in identity, and a
 * profile form is the wrong place to change where account mail goes.
 */
export default function SellerProfileScreen() {
  return (
    <RequireAuth>
      <Profile />
    </RequireAuth>
  );
}

function Profile() {
  const router = useRouter();
  const { profile, session, refreshProfile, getToken, setMode } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<LocalImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const folder = useMemo(
    () => (session?.uid ? IMAGE_FOLDERS.shop(session.uid) : 'avatars'),
    [session?.uid],
  );

  useEffect(() => {
    setFullName(String((profile as any)?.fullName ?? ''));
    setPhone(String((profile as any)?.phoneNumber ?? ''));
    setBio(String((profile as any)?.bio ?? ''));
    if (profile?.profilePictureUrl) {
      setAvatar([
        {
          key: 'avatar',
          uri: profile.profilePictureUrl,
          uploadedUrl: profile.profilePictureUrl,
          status: 'ready',
        },
      ]);
    }
  }, [profile]);

  const save = async () => {
    const next: Record<string, string> = {};
    const nameError = validateName(fullName);
    if (nameError) next.fullName = nameError;
    const phoneError = validatePhone(phone);
    if (phoneError) next.phone = phoneError;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    setFailure(null);
    setSaved(false);
    try {
      const token = await getToken();
      await seller.updateProfile(token, {
        fullName: clean(fullName),
        phoneNumber: clean(phone),
        bio: bio.trim(),
        profilePictureUrl: avatar.length ? storedRef(avatar[0]) ?? '' : '',
      });
      await refreshProfile();
      setSaved(true);
    } catch (thrown) {
      setFailure(messageFor(thrown));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SellerHeader title="Seller profile" subtitle="Your account as a seller" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Avatar
            uri={profile?.profilePictureUrl}
            name={profile?.fullName || profile?.shopName}
            size={72}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.name}>{profile?.fullName || 'Vidnov seller'}</Text>
            <Muted>{profile?.shopName || 'No shop name yet'}</Muted>
            <View style={styles.badges}>
              <Badge label={(profile?.userRole ?? 'buyer').toUpperCase()} tone="primary" />
              {profile?.shopName ? <Badge label="Shop owner" /> : null}
            </View>
          </View>
        </View>

        <SectionHeader title="Avatar" />
        <ImageManager
          images={avatar}
          onChange={setAvatar}
          folder={folder}
          max={1}
          title="Profile photo"
          hint="Shown next to your messages and reviews."
        />

        <SectionHeader title="Your details" />
        <Field label="Full name" value={fullName} onChangeText={setFullName} error={errors.fullName} />
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <Field
          label="Short bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A line about you and your business"
          multiline
          numberOfLines={3}
          style={styles.textarea}
        />
        <Field
          label="Email (sign-in address)"
          value={profile?.email ?? session?.email ?? ''}
          editable={false}
          style={{ opacity: 0.6 }}
        />
        <Muted>
          Changing your email is an account security step, so it is handled by support
          rather than this form.
        </Muted>

        {failure ? <Text style={styles.error}>{failure}</Text> : null}
        {saved ? <Text style={styles.saved}>Profile saved.</Text> : null}

        <Button label="Save profile" onPress={save} loading={busy} disabled={busy} />

        <SectionHeader title="Account" />
        <Button
          label="Shop settings"
          variant="outline"
          icon="storefront-outline"
          onPress={() => router.push('/seller/settings')}
        />
        <Button
          label="Switch to buyer"
          variant="ghost"
          icon="bag-handle-outline"
          onPress={async () => {
            await setMode('buyer');
            router.replace('/(tabs)');
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 19, fontWeight: '800' },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
  textarea: { height: 86, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { color: colors.danger, ...type.caption },
  saved: { color: colors.success, ...type.caption },
});
