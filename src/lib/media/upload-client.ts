'use client';

import type { User } from 'firebase/auth';

/**
 * Client-side upload flow for the Vidnov media system:
 *  1. POST the file to /api/media/upload (Bearer ID token).
 *  2. Poll /api/media/status?id=... until READY or FAILED.
 *
 * Keeps the UI responsive: progress is reported while the file uploads,
 * then a friendly PROCESSING phase while the server compresses.
 */

export interface UploadProgress {
  phase: 'uploading' | 'processing' | 'ready' | 'failed';
  percent: number; // 0-100 during upload phase
  url?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface UploadHandle {
  /** Populated as soon as the server accepts the upload (before READY). */
  mediaId: string;
  promise: Promise<UploadProgress>;
}

export interface UploadOwnership {
  /** Attach to a customer request → requests/request_<id>/ (private). */
  requestId?: string;
  /** Attach to a seller offer → requests/offer_<id>/ (private). */
  offerId?: string;
  /** Attach to a feed post. */
  postId?: string;
}

export function uploadMedia(
  file: File,
  user: User | null,
  onProgress?: (p: UploadProgress) => void,
  ownership?: UploadOwnership,
): UploadHandle {
  const report = (p: UploadProgress) => onProgress?.(p);

  // Resolve before the promise so callers that inspect the handle
  // immediately (or after await) see the real id.
  const handle: UploadHandle = { mediaId: '', promise: null as unknown as Promise<UploadProgress> };

  handle.promise = new Promise<UploadProgress>((resolve, reject) => {
    (async () => {
      try {
        if (!user) {
          throw new Error('You must be signed in to upload media.');
        }
        const token = await user.getIdToken();

        // 1. Upload with progress.
        const mediaId = await new Promise<string>((res, rej) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/media/upload');
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              report({ phase: 'uploading', percent: Math.round((e.loaded / e.total) * 100) });
            }
          };
          xhr.onload = () => {
            try {
              const body = JSON.parse(xhr.responseText || '{}');
              if (xhr.status >= 200 && xhr.status < 300 && body.mediaId) res(body.mediaId);
              else rej(new Error(body.error || `Upload rejected (${xhr.status}).`));
            } catch {
              rej(new Error('Upload failed (invalid server response).'));
            }
          };
          xhr.onerror = () => rej(new Error('Network error during upload.'));
          xhr.ontimeout = () => rej(new Error('Upload timed out.'));
          const form = new FormData();
          form.append('file', file);
          if (ownership?.postId) form.append('postId', ownership.postId);
          if (ownership?.requestId) form.append('requestId', ownership.requestId);
          if (ownership?.offerId) form.append('offerId', ownership.offerId);
          xhr.send(form);
        });

        // Surface the id immediately — callers may need it before READY.
        handle.mediaId = mediaId;

        // 2. Poll processing status.
        report({ phase: 'processing', percent: 100 });
        const started = Date.now();
        const timeoutMs = 5 * 60_000; // videos may take a while on a small VPS
        while (Date.now() - started < timeoutMs) {
          await new Promise((r) => setTimeout(r, 1500));
          const res = await fetch(`/api/media/status?id=${encodeURIComponent(mediaId)}`);
          if (!res.ok) continue; // transient — keep polling
          const data = await res.json();
          if (data.status === 'READY') {
            const done: UploadProgress = {
              phase: 'ready',
              percent: 100,
              url: data.url,
              thumbnailUrl: data.thumbnailUrl,
            };
            report(done);
            resolve(done);
            return;
          }
          if (data.status === 'FAILED') {
            const failed: UploadProgress = {
              phase: 'failed',
              percent: 100,
              error: data.error || 'Processing failed.',
            };
            report(failed);
            resolve(failed);
            return;
          }
        }
        const timedOut: UploadProgress = { phase: 'failed', percent: 100, error: 'Processing timed out.' };
        report(timedOut);
        resolve(timedOut);
      } catch (err) {
        const failed: UploadProgress = {
          phase: 'failed',
          percent: 100,
          error: err instanceof Error ? err.message : 'Upload failed.',
        };
        report(failed);
        reject(err);
      }
    })();
  });

  return handle;
}
