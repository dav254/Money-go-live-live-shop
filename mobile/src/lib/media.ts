import type { ImagePickerAsset } from 'expo-image-picker';

import { apiUrl } from './config';
import { ApiError, apiUpload } from './api';

/**
 * MEDIA — one place that knows how a picture becomes a listing image.
 *
 * The pipeline is the website's own: `POST /api/media/upload` (multipart) on
 * the Vidnov VPS, which answers with the stored asset. The app never talks to
 * PocketBase or the disk directly, and it never invents a URL — it stores the
 * reference the server returned and resolves it for display with `apiUrl`.
 */

/** The server's image cap — checked before a byte is spent uploading. */
export const MAX_IMAGE_MB = 10;
export const MAX_IMAGES_PER_LISTING = 8;

export const IMAGE_FOLDERS = {
  product: (uid: string) => `products/${uid}`,
  /** Shop logos, covers and the seller avatar all live in the avatar folder. */
  shop: (uid: string) => `avatars/${uid}`,
} as const;

/** A picked or stored image, with the state the UI needs to show it honestly. */
export interface LocalImage {
  /** Stable key for lists — the picker uri, or the stored reference on edit. */
  key: string;
  /** Local uri for previews, or the stored media reference. */
  uri: string;
  /** Set once the server accepted it (the stored `/api/media/...` reference). */
  uploadedUrl?: string;
  status: 'pending' | 'uploading' | 'ready' | 'failed';
  error?: string;
}

export function imagePreviewUri(image: LocalImage): string {
  return image.uploadedUrl ? apiUrl(image.uploadedUrl) : apiUrl(image.uri);
}

/** The stored reference for an image that finished uploading, if any. */
export function storedRef(image: LocalImage): string | null {
  return image.uploadedUrl || (image.status === 'ready' && !image.uri.startsWith('file:') ? image.uri : null);
}

/** Pre-flight a picker asset so a 40 MB photo is refused before uploading. */
export function validateAsset(asset: ImagePickerAsset): string | null {
  const bytes = asset.fileSize ?? 0;
  if (bytes > MAX_IMAGE_MB * 1024 * 1024) {
    return `That photo is ${(bytes / (1024 * 1024)).toFixed(1)} MB. Pick one under ${MAX_IMAGE_MB} MB.`;
  }
  const type = asset.mimeType ?? '';
  if (type && !/^image\/(jpeg|jpg|png|webp|gif)$/i.test(type)) {
    return 'Use a JPEG, PNG, WebP or GIF image.';
  }
  return null;
}

export function fileNameFor(uri: string, mimeType?: string | null): string {
  const extension = (mimeType || '').split('/')[1] || uri.split('.').pop() || 'jpg';
  const safe = extension.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  return `vidnov-${Date.now()}.${safe}`;
}

/**
 * Upload one image and return its stored reference.
 *
 * The form is deliberately identical to the website's upload client: `folder`
 * plus `file`. React Native's FormData understands the `{ uri, name, type }`
 * file descriptor, which is why the body is not converted to a Blob here.
 */
export async function uploadImage(
  token: string,
  uri: string,
  folder: string,
  mimeType?: string | null,
): Promise<string> {
  const form = new FormData();
  form.append('folder', folder);
  form.append('file', {
    uri,
    name: fileNameFor(uri, mimeType),
    type: mimeType || 'image/jpeg',
  } as unknown as Blob);

  const result = await apiUpload<{ url?: string; thumbnailUrl?: string; mediaId?: string }>(
    '/api/media/upload',
    form,
    token,
  );

  if (!result?.url) {
    throw new ApiError(
      'The upload finished without a file address. Try again.',
      0,
      'missing_url',
    );
  }
  // The stored reference stays relative — the same value the website saves —
  // and `apiUrl` resolves it for every image component.
  return result.url;
}

/** Upload a list sequentially, reporting each one. Failures stay retryable. */
export async function uploadAll(
  token: string,
  images: LocalImage[],
  folder: string,
  onUpdate: (key: string, patch: Partial<LocalImage>) => void,
): Promise<LocalImage[]> {
  const next = [...images];
  for (let index = 0; index < next.length; index += 1) {
    const image = next[index];
    if (image.status === 'ready' && image.uploadedUrl) continue;
    onUpdate(image.key, { status: 'uploading', error: undefined });
    try {
      const url = await uploadImage(token, image.uri, folder);
      onUpdate(image.key, { status: 'ready', uploadedUrl: url, error: undefined });
    } catch (error) {
      onUpdate(image.key, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Upload failed.',
      });
    }
  }
  return next;
}
