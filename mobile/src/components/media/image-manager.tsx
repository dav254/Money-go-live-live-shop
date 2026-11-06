import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { RemoteImage } from '../remote-image';
import { Body, Button, Muted } from '../ui';
import { useAuth } from '../../lib/auth';
import {
  MAX_IMAGES_PER_LISTING,
  imagePreviewUri,
  uploadImage,
  validateAsset,
  type LocalImage,
} from '../../lib/media';
import { colors, radius, spacing, type } from '../../theme';

/**
 * IMAGE MANAGER — pick, capture, preview, reorder, remove, upload, retry.
 *
 * One component for shop branding and listing photos so both surfaces handle
 * media exactly the same way. Images are uploaded the moment they are chosen:
 * by the time the seller taps Publish the references already exist, which is
 * what stops a save from silently dropping its photos.
 *
 * The first image is the primary one — the catalogue, the shop card and the
 * buyer's discovery all read `imageUrl`, which is written from index 0.
 */
export function ImageManager({
  images,
  onChange,
  folder,
  max = MAX_IMAGES_PER_LISTING,
  title = 'Photos',
  hint,
}: {
  images: LocalImage[];
  onChange: (next: LocalImage[]) => void;
  folder: string;
  max?: number;
  title?: string;
  hint?: string;
}) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    (key: string, patch: Partial<LocalImage>) => {
      onChange(images.map((image) => (image.key === key ? { ...image, ...patch } : image)));
    },
    [images, onChange],
  );

  const pushAssets = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      setError(null);
      if (!assets.length) return;

      const room = Math.max(0, max - images.length);
      if (room === 0) {
        setError(`You can add up to ${max} images.`);
        return;
      }

      const accepted: LocalImage[] = [];
      for (const asset of assets.slice(0, room)) {
        const problem = validateAsset(asset);
        if (problem) {
          setError(problem);
          continue;
        }
        accepted.push({
          key: `${asset.assetId ?? asset.uri}-${Date.now()}-${accepted.length}`,
          uri: asset.uri,
          status: 'pending',
        });
      }
      if (!accepted.length) return;

      let next = [...images, ...accepted];
      onChange(next);
      setBusy(true);
      try {
        const token = await getToken();
        for (const image of accepted) {
          updateLocal(next, image.key, { status: 'uploading' });
          try {
            const url = await uploadImage(token, image.uri, folder, null);
            next = updateLocal(next, image.key, { status: 'ready', uploadedUrl: url });
          } catch (thrown) {
            next = updateLocal(next, image.key, {
              status: 'failed',
              error: thrown instanceof Error ? thrown.message : 'Upload failed.',
            });
          }
        }
        onChange(next);
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : 'Could not start the upload.');
      } finally {
        setBusy(false);
      }

      // Local helper bound to THIS list, so the loop above never reads a stale
      // copy while it is still building the next version of the array.
      function updateLocal(list: LocalImage[], key: string, patch: Partial<LocalImage>) {
        const nextList = list.map((item) => (item.key === key ? { ...item, ...patch } : item));
        onChange(nextList);
        return nextList;
      }
    },
    [folder, getToken, images, max, onChange],
  );

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Vidnov needs access to your photos to add images. You can allow it in Android settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, max - images.length),
      quality: 0.85,
    });
    if (!result.canceled) await pushAssets(result.assets);
  };

  const capture = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera needed',
        'Vidnov needs the camera to photograph what you sell. You can allow it in Android settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled) await pushAssets(result.assets);
  };

  const remove = (key: string) => {
    onChange(images.filter((image) => image.key !== key));
  };

  const makePrimary = (key: string) => {
    const chosen = images.find((image) => image.key === key);
    if (!chosen) return;
    onChange([chosen, ...images.filter((image) => image.key !== key)]);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  const retry = async (image: LocalImage) => {
    setBusy(true);
    update(image.key, { status: 'uploading', error: undefined });
    try {
      const token = await getToken();
      const url = await uploadImage(token, image.uri, folder, null);
      update(image.key, { status: 'ready', uploadedUrl: url, error: undefined });
    } catch (thrown) {
      update(image.key, {
        status: 'failed',
        error: thrown instanceof Error ? thrown.message : 'Upload failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Muted>{hint ?? 'The first photo is the one buyers see first.'}</Muted>
        </View>
        <Text style={styles.count}>
          {images.length}/{max}
        </Text>
      </View>

      {images.length > 0 ? (
        <View style={styles.grid}>
          {images.map((image, index) => (
            <View key={image.key} style={styles.tile}>
              <RemoteImage
                source={imagePreviewUri(image)}
                style={styles.thumb}
                label={index === 0 ? 'Primary image' : `Image ${index + 1}`}
                showRetry={false}
              />

              {index === 0 ? (
                <View style={styles.primaryTag}>
                  <Text style={styles.primaryTagText}>Primary</Text>
                </View>
              ) : null}

              {image.status === 'uploading' ? (
                <View style={styles.status}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              ) : null}

              {image.status === 'failed' ? (
                <Pressable
                  style={styles.status}
                  onPress={() => void retry(image)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry this upload"
                >
                  <Ionicons name="refresh" size={18} color={colors.white} />
                  <Text style={styles.statusText}>Retry</Text>
                </Pressable>
              ) : null}

              <View style={styles.tileActions}>
                <IconAction
                  icon="trash-outline"
                  label={`Remove image ${index + 1}`}
                  onPress={() => remove(image.key)}
                />
                {index > 0 ? (
                  <>
                    <IconAction
                      icon="arrow-back"
                      label="Move image left"
                      onPress={() => move(index, -1)}
                    />
                    <IconAction
                      icon="star-outline"
                      label="Make this the primary image"
                      onPress={() => makePrimary(image.key)}
                    />
                  </>
                ) : (
                  <IconAction
                    icon="arrow-forward"
                    label="Move image right"
                    onPress={() => move(index, 1)}
                    disabled={images.length < 2}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={22} color={colors.textFaint} />
          <Body style={{ color: colors.textMuted }}>No photos yet.</Body>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttons}>
        <Button
          label="Choose photos"
          icon="images-outline"
          variant="outline"
          onPress={() => void pick()}
          disabled={busy || images.length >= max}
          style={{ flex: 1 }}
        />
        <Button
          label="Take photo"
          icon="camera-outline"
          variant="outline"
          onPress={() => void capture()}
          disabled={busy || images.length >= max}
          style={{ flex: 1 }}
        />
      </View>

      {busy ? (
        <View style={styles.uploading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Muted>Uploading to Vidnov…</Muted>
        </View>
      ) : null}
    </View>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconAction, disabled && { opacity: 0.35 }]}
    >
      <Ionicons name={icon} size={14} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { color: colors.text, ...type.heading },
  count: { color: colors.textFaint, ...type.caption },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  thumb: { width: '100%', height: '100%', borderRadius: 0 },
  primaryTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  primaryTagText: { color: colors.white, fontSize: 9.5, fontWeight: '800' },
  status: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,10,11,0.6)',
  },
  statusText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  tileActions: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
  },
  iconAction: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(10,10,11,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  error: { color: colors.danger, ...type.caption },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
