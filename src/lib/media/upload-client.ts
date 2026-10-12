export type UploadProgress = { percent: number; phase: 'uploading' | 'processing' | 'done' | 'failed' };

/**
 * uploadMedia - minimal browser-side uploader used by the vidnov-vps branch.
 * - Posts file to /api/media/upload (server route must exist)
 * - Calls onProgress with UploadProgress updates
 * - Returns { promise, abort } where promise resolves to { phase, url, thumbnailUrl } or rejects with Error
 */
export function uploadMedia(file: File, user: any, onProgress?: (p: UploadProgress) => void) {
  const form = new FormData();
  form.append('file', file);
  if (user && user.uid) form.append('userId', user.uid);

  const xhr = new XMLHttpRequest();

  const promise = new Promise<{ phase: string; url?: string; thumbnailUrl?: string; error?: string }>((resolve, reject) => {
    xhr.open('POST', '/api/media/upload');

    // progress while uploading
    xhr.upload.onprogress = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress?.({ percent: pct, phase: 'uploading' });
      }
    };

    xhr.onload = () => {
      try {
        const text = xhr.responseText || '{}';
        const json = JSON.parse(text);
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.({ percent: 100, phase: 'processing' });
          resolve({ phase: 'done', url: json.url, thumbnailUrl: json.thumbnailUrl });
        } else {
          const err = json?.error || `Upload failed with status ${xhr.status}`;
          onProgress?.({ percent: 0, phase: 'failed' });
          reject(new Error(err));
        }
      } catch (err) {
        onProgress?.({ percent: 0, phase: 'failed' });
        reject(err);
      }
    };

    xhr.onerror = () => {
      onProgress?.({ percent: 0, phase: 'failed' });
      reject(new Error('Network error during upload'));
    };

    xhr.onabort = () => {
      onProgress?.({ percent: 0, phase: 'failed' });
      reject(new Error('Upload aborted'));
    };

    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}
