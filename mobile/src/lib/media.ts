import type { ImagePickerAsset } from 'expo-image-picker';

import { apiUrl } from './config';
import { ApiError, apiRequest, apiUpload } from './api';

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
 * BUYER REQUEST MEDIA.
 *
 * Request attachments are uploaded WITHOUT a folder, exactly like the
 * website's marketplace uploader: the media pipeline stores them owned by the
 * caller and unclaimed, and `POST /api/requests` then claims those media ids
 * into the brief (which is what makes them private — only the owner and the
 * matched business can read them). Passing a folder here would publish them.
 *
 * Images resolve synchronously. Videos transcode in the background, so the
 * returned media id is polled through `/api/media/status` until it is READY.
 */
export interface RequestMediaAsset {
  uri: string;
  kind: 'image' | 'video';
  mimeType?: string | null;
  fileName?: string | null;
}

export interface UploadedRequestMedia {
  mediaId: string;
  url?: string;
  thumbnailUrl?: string;
}

async function postRequestMedia(
  token: string,
  asset: RequestMediaAsset,
): Promise<UploadedRequestMedia> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName || fileNameFor(asset.uri, asset.mimeType),
    type:
      asset.mimeType ||
      (asset.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
  } as unknown as Blob);

  const result = await apiUpload<{
    mediaId?: string;
    url?: string;
    thumbnailUrl?: string;
  }>('/api/media/upload', form, token, 120_000);

  if (!result?.mediaId) {
    throw new ApiError(
      'The upload finished without a media reference. Try again.',
      0,
      'missing_media_id',
    );
  }
  return { mediaId: result.mediaId, url: result.url, thumbnailUrl: result.thumbnailUrl };
}

/** Upload one request attachment and wait until it is usable. */
export async function uploadRequestMedia(
  token: string,
  asset: RequestMediaAsset,
): Promise<UploadedRequestMedia> {
  const uploaded = await postRequestMedia(token, asset);
  if (asset.kind === 'image') return uploaded;

  // A video is only attachable once the server has processed it; attaching a
  // PROCESSING id would make the brief reference a file that does not exist yet.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const status = await apiRequest<{ status?: string; url?: string; error?: string | null }>(
      `/api/media/status?id=${encodeURIComponent(uploaded.mediaId)}`,
    );
    if (status.status === 'READY') {
      return { ...uploaded, url: status.url ?? uploaded.url };
    }
    if (status.status === 'FAILED') {
      throw new Error(status.error || 'That video could not be processed. Try another clip.');
    }
  }
  throw new Error('That video is taking too long to process. Try a shorter clip.');
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
