import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import {
  Button,
  ChoiceGroup,
  Display,
  Field,
  Muted,
  Notice,
  Screen,
} from '../../src/components/ui';
import { RemoteImage } from '../../src/components/remote-image';
import { useAuth } from '../../src/lib/auth';
import { commerce, messageFor, ApiError } from '../../src/lib/api';
import { uploadRequestMedia } from '../../src/lib/media';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * POST A REQUEST.
 *
 * The brief is created through `POST /api/requests` — the same endpoint and the
 * same validation the website's request form uses. Attachments are uploaded to
 * the media pipeline first (unclaimed), and their media ids are claimed by the
 * brief when it is created, which is what makes them private to the owner and
 * the matched seller.
 *
 * A failure is always shown as a failure: if the brief is rejected, nothing is
 * reported as posted and no navigation happens.
 */

const CATEGORIES = [
  'Furniture & Decor',
  'Photography & Video',
  'Events & Catering',
  'Construction & Repair',
  'Fashion & Tailoring',
  'Beauty & Wellness',
  'Transport & Logistics',
  'Technology & Digital',
  'Education & Training',
  'Agriculture',
  'Other',
] as const;

type Fulfilment = 'delivery' | 'collection' | 'either';

interface Attachment {
  key: string;
  kind: 'image' | 'video';
  previewUri: string;
  mediaId?: string;
  status: 'uploading' | 'ready' | 'failed';
  error?: string;
}

const MAX_IMAGES = 3;
const MAX_VIDEOS = 1;

export default function NewRequestScreen() {
  const router = useRouter();
  const { status, getToken } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [location, setLocation] = useState('');
  const [fulfilment, setFulfilment] = useState<Fulfilment>('either');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const signedIn = status === 'signedIn';

  const attach = useCallback(
    async (kind: 'image' | 'video') => {
      if (!signedIn) {
        router.push('/sign-in');
        return;
      }

      const count = attachments.filter((item) => item.kind === kind).length;
      if (kind === 'image' && count >= MAX_IMAGES) {
        setFailure(`You can attach up to ${MAX_IMAGES} photos.`);
        return;
      }
      if (kind === 'video' && count >= MAX_VIDEOS) {
        setFailure('You can attach one short video.');
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFailure('Vidnov needs access to your photos to attach them to a request.');
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'image' ? ['images'] : ['videos'],
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 60,
        selectionLimit: 1,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      const key = `${kind}-${Date.now()}`;
      setFailure(null);
      setAttachments((current) => [
        ...current,
        { key, kind, previewUri: asset.uri, status: 'uploading' },
      ]);

      try {
        const token = await getToken();
        const uploaded = await uploadRequestMedia(token, {
          uri: asset.uri,
          kind,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        });
        setAttachments((current) =>
          current.map((item) =>
            item.key === key ? { ...item, status: 'ready', mediaId: uploaded.mediaId } : item,
          ),
        );
      } catch (error) {
        const message = messageFor(error);
        setAttachments((current) =>
          current.map((item) =>
            item.key === key ? { ...item, status: 'failed', error: message } : item,
          ),
        );
      }
    },
    [attachments, getToken, router, signedIn],
  );

  const remove = (key: string) =>
    setAttachments((current) => current.filter((item) => item.key !== key));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (title.trim().length < 5) next.title = 'Give your request a short, clear title (5+ characters).';
    if (description.trim().length < 20) {
      next.description = 'Describe what you need in at least 20 characters.';
    }
    if (!category) next.category = 'Choose the closest category.';

    const min = budgetMin.trim() ? Number(budgetMin.replace(/[^0-9.]/g, '')) : null;
    const max = budgetMax.trim() ? Number(budgetMax.replace(/[^0-9.]/g, '')) : null;
    if (min !== null && (!Number.isFinite(min) || min < 0)) next.budgetMin = 'Enter a valid minimum.';
    if (max !== null && (!Number.isFinite(max) || max < 0)) next.budgetMax = 'Enter a valid maximum.';
    if (min !== null && max !== null && min > max) next.budgetMax = 'The maximum must be at least the minimum.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy) return;
    if (!signedIn) {
      router.push('/sign-in');
      return;
    }
    setFailure(null);
    if (!validate()) return;

    const uploading = attachments.some((item) => item.status === 'uploading');
    if (uploading) {
      setFailure('Wait for your attachments to finish uploading.');
      return;
    }

    setBusy(true);
    try {
      const token = await getToken();
      const mediaIds = attachments
        .filter((item) => item.status === 'ready' && item.mediaId)
        .map((item) => item.mediaId as string);

      const min = budgetMin.trim() ? Number(budgetMin.replace(/[^0-9.]/g, '')) : null;
      const max = budgetMax.trim() ? Number(budgetMax.replace(/[^0-9.]/g, '')) : null;

      const created = await commerce.createRequest(token, {
        title: title.trim(),
        description: description.trim(),
        category,
        budgetMin: min,
        budgetMax: max,
        location: location.trim() || undefined,
        fulfilment,
        mediaIds,
      });

      const id = created?.request?.id;
      if (!id) throw new ApiError('Vidnov did not confirm the request. Try again.', 0, 'no_request');

      router.replace(`/request/${id}`);
    } catch (error) {
      setFailure(messageFor(error));
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) {
    return (
      <Screen>
        <View style={styles.gate}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.primary} />
          <Display>Sign in to post</Display>
          <Muted>A Vidnov account is required so sellers can send you offers.</Muted>
          <Button label="Sign in" onPress={() => router.push('/sign-in')} />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.xs }}>
            <Display>Post a request</Display>
            <Muted>Describe it once. Matched sellers reply with offers you can compare.</Muted>
          </View>

          <Field
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Solid wood dining table, 6 seats"
            maxLength={100}
            error={errors.title}
            style={styles.input}
          />

          <Field
            label="What do you need?"
            value={description}
            onChangeText={setDescription}
            placeholder="Size, material, colour, timing — the details that help a seller quote accurately."
            multiline
            numberOfLines={5}
            maxLength={1200}
            error={errors.description}
            style={styles.textarea}
          />

          <View style={{ gap: spacing.xs }}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipWrap}>
              {CATEGORIES.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setCategory(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === option }}
                  style={[styles.chip, category === option && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === option && { color: colors.primary }]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.category ? <Text style={styles.fieldError}>{errors.category}</Text> : null}
          </View>

          <View style={styles.row}>
            <Field
              label="Budget from"
              value={budgetMin}
              onChangeText={setBudgetMin}
              placeholder="Optional"
              keyboardType="numeric"
              error={errors.budgetMin}
              style={[styles.input, { flex: 1 }]}
            />
            <Field
              label="Budget up to"
              value={budgetMax}
              onChangeText={setBudgetMax}
              placeholder="Optional"
              keyboardType="numeric"
              error={errors.budgetMax}
              style={[styles.input, { flex: 1 }]}
            />
          </View>

          <Field
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="City, town or county"
            style={styles.input}
          />

          <ChoiceGroup<Fulfilment>
            label="Fulfilment"
            options={[
              { value: 'either', label: 'Either' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'collection', label: 'Collection' },
            ]}
            value={fulfilment}
            onChange={setFulfilment}
          />

          <View style={{ gap: spacing.sm }}>
            <Text style={styles.label}>Photos and video (optional)</Text>
            <Muted>
              Attachments are private: only you and the business whose offer you accept can see
              them.
            </Muted>

            <View style={styles.row}>
              <Button
                label="Add photo"
                variant="outline"
                icon="image-outline"
                onPress={() => void attach('image')}
                style={{ flex: 1 }}
              />
              <Button
                label="Add video"
                variant="outline"
                icon="videocam-outline"
                onPress={() => void attach('video')}
                style={{ flex: 1 }}
              />
            </View>

            {attachments.length > 0 ? (
              <View style={styles.attachments}>
                {attachments.map((item) => (
                  <View key={item.key} style={styles.attachment}>
                    <RemoteImage
                      source={item.previewUri}
                      style={styles.attachmentImage}
                      radius={radius.md}
                      label={item.kind === 'video' ? 'Video attachment' : 'Photo attachment'}
                    />
                    <View style={styles.attachmentFooter}>
                      {item.status === 'uploading' ? (
                        <View style={styles.attachmentStatus}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.attachmentText}>
                            {item.kind === 'video' ? 'Processing…' : 'Uploading…'}
                          </Text>
                        </View>
                      ) : item.status === 'failed' ? (
                        <Text style={styles.attachmentError} numberOfLines={2}>
                          {item.error || 'Upload failed'}
                        </Text>
                      ) : (
                        <View style={styles.attachmentStatus}>
                          <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                          <Text style={styles.attachmentText}>Ready</Text>
                        </View>
                      )}
                      <Pressable
                        onPress={() => remove(item.key)}
                        accessibilityRole="button"
                        accessibilityLabel="Remove attachment"
                        hitSlop={8}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {failure ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{failure}</Text>
            </View>
          ) : null}

          <Notice
            title="What happens next"
            body="Vidnov matches your brief with sellers who can supply it. They send offers; you compare price and delivery, then accept one — that is what creates the order."
          />

          <Button label="Publish request" onPress={submit} loading={busy} disabled={busy} />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  label: { color: colors.textMuted, ...type.caption },
  input: { minHeight: 46 },
  textarea: { minHeight: 116, textAlignVertical: 'top', paddingTop: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  fieldError: { color: colors.danger, ...type.caption },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  attachment: { width: 132, gap: spacing.xs },
  attachmentImage: { width: 132, height: 100, backgroundColor: colors.surfaceRaised },
  attachmentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  attachmentStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  attachmentText: { color: colors.textMuted, fontSize: 11 },
  attachmentError: { color: colors.danger, fontSize: 11, flex: 1 },
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
