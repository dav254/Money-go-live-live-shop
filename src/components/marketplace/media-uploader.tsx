'use client';

import * as React from 'react';
import type { User } from 'firebase/auth';
import { uploadMedia } from '@/lib/media/upload-client';
import type { UploadProgress } from '@/lib/media/upload-client';
import { privateMediaUrl } from '@/lib/requests/client';
import { ImagePlus, Loader2, Trash2, Video as VideoIcon, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Marketplace attachment uploader (spec §24, §31).
 *
 * Uses the SAME media system as the rest of Vidnov (upload client + VPS
 * pipeline) — files land in requests/request_<id>/ or requests/offer_<id>/
 * and are processed (WebP/H.264 + thumbnails) exactly like everything else.
 * Limits are enforced twice: client-side UX and server-side truth.
 */

export interface AttachedMedia {
  /** Firestore media record id — the only handle the API needs. */
  mediaId: string;
  type: 'image' | 'video';
  url?: string;
  thumbnailUrl?: string;
}

interface MarketplaceMediaUploaderProps {
  /** Nullable: the uploader renders a sign-in hint when auth is pending. */
  user: User | null;
  /** Bind media to a request — requests/request_<id>/ (private). */
  requestId?: string;
  /** Bind media to an offer — requests/offer_<id>/ (private). */
  offerId?: string;
  images: AttachedMedia[];
  videos: AttachedMedia[];
  onChange: (next: { images: AttachedMedia[]; videos: AttachedMedia[] }) => void;
  maxImages?: number;
  maxVideos?: number;
  disabled?: boolean;
}

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;
const MAX_VIDEO_SECONDS = 30;

function fmtMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function MarketplaceMediaUploader({
  user,
  requestId,
  offerId,
  images,
  videos,
  onChange,
  maxImages = 5,
  maxVideos = 2,
  disabled,
}: MarketplaceMediaUploaderProps) {
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = React.useState(0);
  const [progress, setProgress] = React.useState<Record<string, UploadProgress>>({});
  const [error, setError] = React.useState<string | null>(null);

  // Ownership fields are passed to the server at upload time (see uploadMedia).

  const handleFiles = React.useCallback(
    async (files: FileList | null, kind: 'image' | 'video') => {
      if (!files || files.length === 0 || disabled) return;
      setError(null);

      const limit = kind === 'image' ? maxImages : maxVideos;
      const existing = kind === 'image' ? images.length : videos.length;
      const room = limit - existing;
      if (room <= 0) {
        setError(`Maximum ${limit} ${kind === 'image' ? 'images' : 'videos'}.`);
        return;
      }

      const picked = Array.from(files).slice(0, room);
      setUploadingCount((n) => n + picked.length);

      for (const file of picked) {
        // Client-side pre-validation mirrors the server rules for fast feedback.
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (kind === 'image' && !isImage) {
          setError('Please choose an image file (JPG, PNG or WebP).');
          continue;
        }
        if (kind === 'video' && !isVideo) {
          setError('Please choose a video file (MP4 recommended).');
          continue;
        }
        const maxMb = kind === 'image' ? MAX_IMAGE_MB : MAX_VIDEO_MB;
        if (file.size > maxMb * 1024 * 1024) {
          setError(`File is too large (${fmtMb(file.size)}). Maximum ${maxMb}MB.`);
          continue;
        }
        if (kind === 'video' && file.type === 'video/mp4') {
          const seconds = await probeVideoDuration(file);
          if (seconds > MAX_VIDEO_SECONDS) {
            setError(`Video is ${Math.round(seconds)}s — maximum is ${MAX_VIDEO_SECONDS}s.`);
            continue;
          }
        }

        if (!user) {
          setError('You must be signed in to upload media. Please wait for sign-in or refresh.');
          continue;
        }

        const key = `${file.name}-${Date.now()}`;
        setProgress((p) => ({ ...p, [key]: { phase: 'uploading', percent: 0 } }));

        try {
          const handle = uploadMedia(
            file,
            user,
            (p) => {
              setProgress((prev) => ({ ...prev, [key]: p }));
            },
            { requestId, offerId },
          );
          const result = await handle.promise;
          if (result.phase === 'ready' && handle.mediaId) {
            const attached: AttachedMedia = {
              mediaId: handle.mediaId,
              type: kind,
              url: result.url,
              thumbnailUrl: result.thumbnailUrl,
            };
            if (kind === 'image') {
              onChange({ images: [...images, attached], videos });
            } else {
              onChange({ images, videos: [...videos, attached] });
            }
          } else if (result.phase === 'failed') {
            setError(result.error || 'Upload failed.');
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Upload failed.');
        } finally {
          setProgress((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
      }

      setUploadingCount((n) => Math.max(0, n - picked.length));
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    },
    [disabled, images, videos, maxImages, maxVideos, onChange, user, requestId, offerId],
  );

  const removeMedia = (mediaId: string) => {
    onChange({
      images: images.filter((m) => m.mediaId !== mediaId),
      videos: videos.filter((m) => m.mediaId !== mediaId),
    });
  };

  const busy = uploadingCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || images.length >= maxImages}
          onClick={() => imageInputRef.current?.click()}
          className="rounded-xl"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          Add Images
          <span className="ml-1 text-[10px] text-muted-foreground">
            {images.length}/{maxImages}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || videos.length >= maxVideos}
          onClick={() => videoInputRef.current?.click()}
          className="rounded-xl"
        >
          <VideoIcon className="mr-2 h-4 w-4" />
          Add Video
          <span className="ml-1 text-[10px] text-muted-foreground">
            {videos.length}/{maxVideos}
          </span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        You can add photos or a short video (max {MAX_VIDEO_SECONDS}s, {MAX_VIDEO_MB}MB) to
        explain what you need. Images up to {MAX_IMAGE_MB}MB each.
      </p>

      {error && (
        <p className="text-xs font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Thumbnails / progress tiles */}
      {(images.length > 0 || videos.length > 0 || Object.keys(progress).length > 0) && (
        <div className="flex flex-wrap gap-3">
          {images.map((m) => (
            <AttachmentTile
              key={m.mediaId}
              media={m}
              onRemove={() => removeMedia(m.mediaId)}
              disabled={disabled}
            />
          ))}
          {videos.map((m) => (
            <AttachmentTile
              key={m.mediaId}
              media={m}
              onRemove={() => removeMedia(m.mediaId)}
              disabled={disabled}
            />
          ))}
          {Object.entries(progress).map(([key, p]) => (
            <div
              key={key}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted/40"
            >
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                {p.phase === 'uploading' ? `${p.percent}%` : 'Processing'}
              </span>
            </div>
          ))}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files, 'image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => void handleFiles(e.target.files, 'video')}
      />
    </div>
  );
}

function AttachmentTile({
  media,
  onRemove,
  disabled,
}: {
  media: AttachedMedia;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const src = media.thumbnailUrl || media.url || privateMediaUrl(media.mediaId, true);
  return (
    <div className="group relative h-20 w-20 overflow-hidden rounded-xl border bg-muted">
      {media.type === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Attachment" className="h-full w-full object-cover" />
      ) : (
        <div className="relative h-full w-full bg-navy-900/90">
          {media.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.thumbnailUrl} alt="" className="h-full w-full object-cover opacity-80" />
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
          <Play className="absolute inset-0 m-auto h-5 w-5 text-white" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove attachment"
        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Reads the real duration with a throwaway <video> element (MP4/WebM). */
export function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration || 0);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
      video.src = url;
    } catch {
      resolve(0);
    }
  });
}
