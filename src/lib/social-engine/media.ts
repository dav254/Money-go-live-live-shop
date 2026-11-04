/**
 * SOCIAL ENGINE — platform media capability table + pre-publish validation.
 *
 * ONE configuration for media limits (task §11): the hard limits always come
 * from the existing `MEDIA_CONFIG` (VIDNOV_* variables with safe defaults —
 * the same names `config.ts` and `limits.ts` already read). This table adds
 * only the PER-PLATFORM ceilings that are stricter than Vidnov's own, so an
 * over-sized or wrong-format asset is refused BEFORE a platform rejects it.
 *
 * Nothing here processes media: validation/variants/thumbnails keep going
 * through the existing pipeline (`processImage`, `probeVideo`,
 * `validateVideoFile`) — one storage system, no duplicate processor.
 *
 * Platform figures are conservative published limits used as a pre-flight
 * check; the platform's own response remains the final authority (the note
 * says so — we never claim a platform accepted anything it did not).
 */
import { ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME, MEDIA_CONFIG } from '@/lib/media/config';

export interface PlatformMediaCaps {
  /** Dashboard/module id this cap belongs to. */
  id: string;
  label: string;
  /** Image MIME types this platform accepts (subset of Vidnov's allowed set). */
  imageMime: readonly string[];
  /** Max single image bytes for upload (platform cap, capped by Vidnov's own). */
  maxImageBytes: number;
  /** Max images in one post, when the platform limits it. */
  maxImages: number;
  /** Max image edge in px, when the platform documents one. */
  maxImageDimension?: number;
  /** Video support (undefined = images only). */
  video?: {
    mime: readonly string[];
    maxBytes: number;
    maxSeconds: number;
    maxHeight: number;
  };
  /** Honest, static note about what the platform supports. */
  notes: string;
}

const MB = 1024 * 1024;

export const PLATFORM_MEDIA_CAPS: readonly PlatformMediaCaps[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    imageMime: ['image/jpeg', 'image/png'],
    maxImageBytes: 10 * MB,
    maxImages: 1,
    video: {
      mime: ['video/mp4'],
      maxBytes: 50 * MB,
      maxSeconds: 60,
      maxHeight: 1280,
    },
    notes: 'Bot API: photos (JPEG/PNG) with caption; MP4 videos up to 50 MB. Documents of other types can be sent as files.',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    imageMime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxImageBytes: 1 * MB,
    maxImages: 4,
    maxImageDimension: 2000,
    notes: 'AT Protocol record: up to 4 images per post (JPEG/PNG/WebP/GIF, 1 MB each as compressed by the pipeline).',
  },
  {
    id: 'tumblr',
    label: 'Tumblr',
    imageMime: ['image/jpeg', 'image/png', 'image/gif'],
    maxImageBytes: 20 * MB,
    maxImages: 10,
    video: {
      mime: ['video/mp4'],
      maxBytes: 500 * MB,
      maxSeconds: 600,
      maxHeight: 1080,
    },
    notes: 'Photo posts accept multiple images; video posts accept MP4. Processed WebP is converted to JPEG before upload.',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    imageMime: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxImageBytes: 8 * MB,
    maxImages: 4,
    maxImageDimension: 4096,
    video: {
      mime: ['video/mp4', 'video/webm'],
      maxBytes: 40 * MB,
      maxSeconds: 600,
      maxHeight: 1080,
    },
    notes: 'Instance media limits (4 attachments, 8 MB each on mastodon.social) — stricter instances may reject sooner.',
  },
  {
    id: 'discord',
    label: 'Discord',
    imageMime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxImageBytes: 10 * MB,
    maxImages: 10,
    video: {
      mime: ['video/mp4'],
      maxBytes: 10 * MB,
      maxSeconds: 60,
      maxHeight: 1080,
    },
    notes: 'Embeds + attachments via webhook/bot; non-privileged bots post up to 5 messages per 5 seconds (rate limit respected by the adapter).',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    imageMime: [],
    maxImageBytes: 0,
    maxImages: 0,
    video: {
      mime: ['video/mp4'],
      maxBytes: 500 * MB,
      maxSeconds: 600,
      maxHeight: 1080,
    },
    notes: 'Content Posting API accepts video only (FILE_UPLOAD). Draft-mode handoff (Share-to-TikTok) is a handoff, never a published post.',
  },
  {
    id: 'facebook',
    label: 'Facebook Pages',
    imageMime: ['image/jpeg', 'image/png'],
    maxImageBytes: 10 * MB,
    maxImages: 1,
    video: {
      mime: ['video/mp4'],
      maxBytes: 1 * 1024 * MB,
      maxSeconds: 14400,
      maxHeight: 1080,
    },
    notes: 'Page feed posts: link/photo/video. Photos are uploaded as a public image URL to the Graph API; video processing is asynchronous (status checked separately).',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    imageMime: ['image/jpeg'],
    maxImageBytes: 8 * MB,
    maxImages: 1,
    maxImageDimension: 1440,
    video: {
      mime: ['video/mp4'],
      maxBytes: 100 * MB,
      maxSeconds: 60,
      maxHeight: 1920,
    },
    notes: 'Content Publishing: single image (JPEG) or MP4 video per post via a public media URL; carousels are out of scope here.',
  },
];

export function capsForPlatform(id: string): PlatformMediaCaps | null {
  return PLATFORM_MEDIA_CAPS.find((c) => c.id === id) ?? null;
}

export interface MediaCheckInput {
  kind: 'image' | 'video';
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface MediaCheckResult {
  ok: boolean;
  /** Static, safe-to-display reason. Never a provider body. */
  note: string;
}

/**
 * Pre-flight validation against BOTH Vidnov's own limits (always enforced by
 * the media pipeline) and the platform's stricter ceiling. Returns a static
 * note naming the violated bound — no values from the asset travel beyond
 * this boolean + note.
 */
export function validateForPlatform(platformId: string, input: MediaCheckInput): MediaCheckResult {
  const caps = capsForPlatform(platformId);
  if (!caps) return { ok: false, note: `Unknown platform "${platformId}" — no media capability defined.` };

  // Vidnov's own gate first: one configuration, no per-platform bypass.
  const ownMime = input.kind === 'image' ? ALLOWED_IMAGE_MIME : ALLOWED_VIDEO_MIME;
  if (!ownMime.has(input.mime)) {
    return { ok: false, note: `Vidnov's media pipeline does not accept ${input.mime} for ${input.kind}s.` };
  }
  const ownMaxBytes =
    (input.kind === 'image' ? MEDIA_CONFIG.IMAGE_MAX_UPLOAD_MB : MEDIA_CONFIG.VIDEO_MAX_UPLOAD_MB) * MB;
  if (input.bytes > ownMaxBytes) {
    return { ok: false, note: `Exceeds Vidnov's ${input.kind} upload cap for ${caps.label}.` };
  }

  if (input.kind === 'image') {
    if (caps.maxImages === 0 || caps.imageMime.length === 0) {
      return { ok: false, note: `${caps.label} does not accept standalone image posts.` };
    }
    if (!caps.imageMime.includes(input.mime)) {
      return { ok: false, note: `${caps.label} does not accept ${input.mime} — use ${caps.imageMime.join(', ')}.` };
    }
    if (input.bytes > caps.maxImageBytes) {
      return { ok: false, note: `Exceeds ${caps.label}'s image size limit.` };
    }
    const edge = Math.max(input.width ?? 0, input.height ?? 0);
    if (caps.maxImageDimension && edge > caps.maxImageDimension) {
      return { ok: false, note: `Exceeds ${caps.label}'s ${caps.maxImageDimension}px edge limit.` };
    }
    return { ok: true, note: `Image fits ${caps.label}'s published limits (pipeline still re-validates).` };
  }

  const video = caps.video;
  if (!video) return { ok: false, note: `${caps.label} does not accept video posts.` };
  if (!video.mime.includes(input.mime)) {
    return { ok: false, note: `${caps.label} does not accept ${input.mime} — use ${video.mime.join(', ')}.` };
  }
  if (input.bytes > video.maxBytes) {
    return { ok: false, note: `Exceeds ${caps.label}'s video size limit.` };
  }
  if (input.durationSeconds != null && input.durationSeconds > video.maxSeconds) {
    return { ok: false, note: `Exceeds ${caps.label}'s ${video.maxSeconds}s duration limit.` };
  }
  if (input.height != null && input.height > video.maxHeight) {
    return { ok: false, note: `Exceeds ${caps.label}'s ${video.maxHeight}p height limit.` };
  }
  return { ok: true, note: `Video fits ${caps.label}'s published limits (pipeline still re-validates).` };
}
