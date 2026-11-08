import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { Avatar, Button, Display, Field, Loading, Muted, Notice, Screen } from '../../src/components/ui';
import { useAuth } from '../../src/lib/auth';
import { account, messageFor } from '../../src/lib/api';
import { IMAGE_FOLDERS, uploadImage } from '../../src/lib/media';
import { useAuthedResource } from '../../src/lib/use-authed';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * EDIT PROFILE.
 *
 * Writes the same `userProfiles/{uid}` document the website shows, through
 * `PATCH /api/mobile/seller/profile` (an account route — it needs a verified
 * account, not a seller role). Nothing is stored locally beyond the cached
 * profile the auth context already refreshes.
 *
 * The avatar goes through the existing media pipeline into `avatars/<uid>`, and
 * the stored reference is saved on the profile only after the upload succeeded.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, getToken, refreshProfile } = useAuth();
  const fresh = useAuthedResource((token) => account.profile(token), []);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Prefill once from the server copy (the cached profile has no phone or bio).
  useEffect(() => {
    const source = fresh.data?.profile ?? profile;
    if (!source) return;
    setFullName((current) => current || String(source.fullName ?? source.name ?? ''));
    setPhoneNumber((current) => current || String(source.phoneNumber ?? source.phone ?? ''));
    setBio((current) => current || String(source.bio ?? ''));
    setAvatar((current) => current ?? (source.profilePictureUrl ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh.data, profile]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Vidnov needs access to your photos to set a profile picture.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      selectionLimit: 1,
    });
    if (picked.canceled || !picked.assets?.length) return;

    const asset = picked.assets[0];
    setUploading(true);
    setError(null);
    try {
      const token = await getToken();
      const uid = String(profile?.uid ?? profile?.id ?? '');
      if (!uid) throw new Error('Your account id is unavailable. Refresh and try again.');
      const stored = await uploadImage(token, asset.uri, IMAGE_FOLDERS.shop(uid), asset.mimeType);
      setAvatar(stored);
    } catch (uploadError) {
      setError(messageFor(uploadError));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    if (fullName.trim().length < 2) {
      setError('Enter the name you want buyers and sellers to see.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      await account.updateProfile(token, {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        bio: bio.trim(),
        ...(avatar ? { profilePictureUrl: avatar } : {}),
      });
      await refreshProfile();
      setSaved(true);
      router.back();
    } catch (saveError) {
      setError(messageFor(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <Screen>
        <Loading label="Loading your profile…" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs }}>
            <Display>Edit profile</Display>
            <Muted>This is what buyers and sellers see across Vidnov.</Muted>
          </View>

          <View style={styles.avatarRow}>
            <Avatar uri={avatar} name={fullName} size={84} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Button
                label={uploading ? 'Uploading…' : 'Change photo'}
                variant="outline"
                icon="camera-outline"
                loading={uploading}
                onPress={() => void pickAvatar()}
              />
              <Muted>Square photo, up to 10 MB.</Muted>
            </View>
          </View>

          <Field
            label="Display name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name or business name"
            maxLength={80}
            autoCapitalize="words"
            style={styles.input}
          />

          <Field
            label="Phone"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Optional — only shared with sellers you deal with"
            keyboardType="phone-pad"
            maxLength={24}
            style={styles.input}
          />

          <Field
            label="About you"
            value={bio}
            onChangeText={setBio}
            placeholder="A short line buyers see on your profile"
            multiline
            numberOfLines={4}
            maxLength={500}
            style={styles.textarea}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {saved ? <Notice title="Saved" body="Your profile is updated on every surface." /> : null}

          <Button label="Save changes" onPress={save} loading={saving} disabled={saving || uploading} />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  input: { minHeight: 46 },
  textarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(240, 68, 56, 0.12)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, ...type.caption, flex: 1 },
});
