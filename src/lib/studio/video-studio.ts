/**
 * VIDEO STUDIO — shared, PURE model for the seller Video Studio.
 *
 * No fs, no firebase, no child_process: this module is imported by BOTH the
 * browser (the studio UI builds drafts and render plans from it) and the
 * server (the mix/publish routes execute exactly the plans the UI showed),
 * so every limit the seller sees is the same limit the server enforces.
 *
 * The heavy lifting lives elsewhere:
 *   • rendering (ffmpeg)  → src/lib/media/soundtrack.ts  (server-only)
 *   • publishing          → /api/video-studio/publish    (server-only)
 *
 * The Firestore document this describes (`studioVideos/{id}`) is private to
 * its owner: drafts and processing state never leave the seller, and only the
 * publish route creates the PUBLIC listing in `products`, which is the
 * collection Discovery and the public shop already read.
 */

/* ── Limits ─────────────────────────────────────────────────────────────── */

export const TITLE_MAX = 120;
export const TITLE_MIN = 3;
export const CAPTION_MAX = 2000;
export const OVERLAY_MAX = 120;
export const HASHTAG_MAX = 300;
export const LOCATION_MAX = 120;
export const VIDEO_MAX_SECONDS = 120; // hard stop for the studio (uploads are capped at 60s by the engine; allow re-exports)

/** Trim must leave at least this much of the clip standing. */
export const TRIM_MIN_SEGMENT = 0.5;
/** Soundtrack fades are capped so a filter graph can never go negative. */
export const FADE_MAX = 5;

export type AspectRatio = 'original' | '9:16' | '1:1' | '16:9';

export type StudioVideoStatus =
  | 'draft'
  | 'rendering'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed';

export interface TrimSettings {
  startSeconds: number;
  endSeconds: number;
}

export interface OverlayText {
  text: string;
  position: 'top' | 'bottom';
}

/**
 * The soundtrack as the seller composed it. Every number is clamped server-
 * side by `sanitizeSoundtrack` before it can reach ffmpeg, so a tampered
 * request cannot ask for a negative volume or a fade longer than the clip.
 *
 * Exactly one of `musicMediaId` (the seller's own upload under
 * `music/<uid>/`) or `catalogueTrackId` (a licensed track from the music
 * catalogue) is set — the server resolves either to a local file and refuses
 * anything else.
 */
export interface SoundtrackSettings {
  musicMediaId?: string;
  catalogueTrackId?: string;
  /** Where inside the music to start (seconds). */
  startSeconds: number;
  /** Background music volume, 0..1. */
  musicVolume: number;
  /** Original video audio volume, 0..1 (0 with muteOriginal). */
  originalVolume: number;
  muteOriginal: boolean;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  /** Restart the (≤30s) music when the video is longer than the track. */
  loop: boolean;
}

/** Everything the studio persists about one video. Pure data. */
export interface StudioVideoDoc {
  sellerId: string;
  status: StudioVideoStatus;
  source: {
    mediaId: string;
    url: string;
    thumbnailUrl?: string | null;
    durationSeconds?: number;
    width?: number;
    height?: number;
    name?: string;
  };
  final?: {
    mediaId: string;
    url: string;
    thumbnailUrl?: string | null;
    rendered?: boolean;
  } | null;
  trim?: TrimSettings | null;
  aspect?: AspectRatio;
  overlay?: OverlayText | null;
  coverAtSeconds?: number;
  soundtrack?: SoundtrackSettings | null;
  soundtrackTitle?: string | null;
  details?: {
    title?: string;
    caption?: string;
    category?: string;
    hashtags?: string;
    visibility?: 'public' | 'unlisted';
    location?: string;
    productId?: string | null;
    cta?: string;
  };
  /** Public listing id once published (never a URL, never a path). */
  publishedDocId?: string | null;
  /**
   * A render started but not yet finished (page closed mid-processing).
   * The id to poll on `/api/media/status` when the draft is reopened — the
   * only way a resumed draft can pick up where it left off.
   */
  pendingMediaId?: string | null;
  error?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
}

/* ── Sanitizers (the server trusts ONLY these) ──────────────────────────── */

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

/**
 * Clamps a soundtrack into safe bounds. Returns null when there is no usable
 * music source — a soundtrack request without a resolvable source is refused
 * outright rather than silently published without music.
 */
export function sanitizeSoundtrack(raw: unknown): SoundtrackSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const musicMediaId = typeof r.musicMediaId === 'string' ? r.musicMediaId.trim() : '';
  const catalogueTrackId =
    typeof r.catalogueTrackId === 'string' ? r.catalogueTrackId.trim() : '';
  if (!musicMediaId && !catalogueTrackId) return null;
  // A bare id — never a path (the server resolves ids, not paths).
  const idOk = (id: string) => /^[A-Za-z0-9_-]{6,64}$/.test(id);
  if (musicMediaId && !idOk(musicMediaId)) return null;
  if (catalogueTrackId && !/^[A-Za-z0-9_-]{1,64}$/.test(catalogueTrackId)) return null;

  const muteOriginal = r.muteOriginal === true;
  return {
    musicMediaId: musicMediaId || undefined,
    catalogueTrackId: catalogueTrackId || undefined,
    startSeconds: clamp(r.startSeconds, 0, VIDEO_MAX_SECONDS, 0),
    musicVolume: clamp(r.musicVolume, 0, 1, 1),
    originalVolume: muteOriginal ? 0 : clamp(r.originalVolume, 0, 1, 1),
    muteOriginal,
    fadeInSeconds: clamp(r.fadeInSeconds, 0, FADE_MAX, 0),
    fadeOutSeconds: clamp(r.fadeOutSeconds, 0, FADE_MAX, 0),
    loop: r.loop === true,
  };
}

/** Trim within [0, duration]; null when it would not actually cut anything. */
export function sanitizeTrim(
  raw: unknown,
  durationSeconds: number,
): TrimSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const dur = clamp(durationSeconds, 1, VIDEO_MAX_SECONDS, 0);
  if (!dur) return null;
  const start = clamp(r.startSeconds, 0, dur, 0);
  const end = clamp(r.endSeconds, 0, dur, dur);
  if (end - start < TRIM_MIN_SEGMENT) return null;
  if (start <= 0.05 && end >= dur - 0.05) return null; // full clip = no trim
  return { startSeconds: round3(start), endSeconds: round3(end) };
}

export function sanitizeOverlay(raw: unknown): OverlayText | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = cleanText(r.text, OVERLAY_MAX);
  if (!text) return null;
  return { text, position: r.position === 'bottom' ? 'bottom' : 'top' };
}

export function sanitizeAspect(raw: unknown): AspectRatio {
  return raw === '9:16' || raw === '1:1' || raw === '16:9' ? raw : 'original';
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/* ── Publish validation ─────────────────────────────────────────────────── */

export interface PublishDetails {
  title: string;
  caption: string;
  category: string;
  hashtags: string;
  visibility: 'public' | 'unlisted';
  location: string;
  productId?: string | null;
  cta?: string;
}

/** Returns an error string, or null when the details are publishable. */
export function validatePublishDetails(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'Give your video a title.';
  const r = raw as Record<string, unknown>;
  const title = cleanText(r.title, TITLE_MAX);
  if (title.length < TITLE_MIN) return `Title must be at least ${TITLE_MIN} characters.`;
  if (cleanText(r.caption, CAPTION_MAX + 1).length > CAPTION_MAX) {
    return `Caption must be ${CAPTION_MAX} characters or fewer.`;
  }
  if (cleanText(r.hashtags, HASHTAG_MAX + 1).length > HASHTAG_MAX) {
    return `Hashtags must be ${HASHTAG_MAX} characters or fewer.`;
  }
  return null;
}

export function sanitizePublishDetails(raw: unknown): PublishDetails {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const visibility = r.visibility === 'unlisted' ? 'unlisted' : 'public';
  const productId =
    typeof r.productId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(r.productId.trim())
      ? r.productId.trim()
      : null;
  return {
    title: cleanText(r.title, TITLE_MAX),
    caption: cleanText(r.caption, CAPTION_MAX),
    category: cleanText(r.category, 64),
    hashtags: cleanText(r.hashtags, HASHTAG_MAX),
    visibility,
    location: cleanText(r.location, LOCATION_MAX),
    productId,
    cta: cleanText(r.cta, 80),
  };
}

/**
 * The PUBLIC listing document for a standalone studio video (no linked
 * product). Deliberately shaped like every other `products` document so
 * Discovery, the public shop's Videos tab and the product page render it
 * with zero special-casing:
 *
 *   • `videoUrl`/`videoUrls` + `videoThumbnailUrls` → Discovery renders it
 *     as an immersive video post with a real poster (see lib/discovery.ts);
 *   • `stock: 0` → `isPurchasable` is false, so no one can buy an intro
 *     video by accident, while Chat / the shop link stay live;
 *   • `studioVideoId` ties it back to the studio record for the seller.
 *
 * Pure: timestamps are injected by the caller.
 */
export function buildStandaloneVideoDoc(input: {
  sellerId: string;
  details: PublishDetails;
  videoUrl: string;
  posterUrl: string;
  studioVideoId: string;
  createdAt: unknown;
}): Record<string, unknown> {
  const tags = input.details.hashtags
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(', ');

  return {
    sellerId: input.sellerId,
    name: input.details.title,
    description: input.details.caption,
    price: 0,
    stock: 0,
    availabilityState: 'on_request',
    listingType: 'product',
    category: input.details.category || 'video',
    ...(tags ? { tags } : {}),
    ...(input.details.location ? { location: input.details.location } : {}),
    imageUrl: input.posterUrl || '',
    imageUrls: input.posterUrl ? [input.posterUrl] : [],
    thumbnailUrls: input.posterUrl ? [input.posterUrl] : [],
    videoUrl: input.videoUrl,
    videoUrls: [input.videoUrl],
    videoThumbnailUrls: [input.posterUrl || ''],
    hasVideo: true,
    mediaKind: 'photo', // not a living picture: this is a real video post
    studioVideoId: input.studioVideoId,
    uploadDate: input.createdAt,
    likes: 0,
    viewCount: 0,
    inCartCount: 0,
    salesCount: 0,
  };
}

/**
 * The field patch applied to an EXISTING product when a studio video is
 * attached to it: the video leads the listing, previous clips are kept, and
 * posters stay index-aligned with `videoUrls` (Discovery pairs them 1:1).
 * Never touches price, stock, images or sellerId — attaching a promo video
 * must not mutate the listing a buyer already sees beyond its media.
 */
export function buildAttachToProductPatch(input: {
  videoUrl: string;
  posterUrl: string;
  existingVideoUrls?: unknown;
  existingPosters?: unknown;
  updatedAt: unknown;
}): Record<string, unknown> {
  const urls = Array.isArray(input.existingVideoUrls)
    ? (input.existingVideoUrls as unknown[]).filter((u) => typeof u === 'string' && u)
    : [];
  const posters = Array.isArray(input.existingPosters)
    ? (input.existingPosters as unknown[]).map((u) => (typeof u === 'string' ? u : ''))
    : [];
  if (!urls.includes(input.videoUrl)) {
    // posters must line up with urls: pad before pushing the new pair.
    while (posters.length < urls.length) posters.push('');
    urls.push(input.videoUrl);
    posters.push(input.posterUrl || '');
  } else {
    const idx = urls.indexOf(input.videoUrl);
    if (input.posterUrl && !posters[idx]) posters[idx] = input.posterUrl;
    while (posters.length < urls.length) posters.push('');
  }
  return {
    videoUrl: urls[0] ?? input.videoUrl,
    videoUrls: urls,
    videoThumbnailUrls: posters,
    hasVideo: true,
    updatedAt: input.updatedAt,
  };
}

/* ── ffmpeg plan ────────────────────────────────────────────────────────── */

export interface RenderPlan {
  videoPath: string;
  musicPath?: string;
  outPath: string;
  textFilePath?: string;
  /** Source duration in seconds. */
  durationSeconds: number;
  width: number;
  height: number;
  videoHasAudio: boolean;
  trim?: TrimSettings | null;
  aspect?: AspectRatio;
  overlay?: OverlayText | null;
  coverAtSeconds?: number;
  soundtrack?: SoundtrackSettings | null;
  musicDurationSeconds?: number;
}

/** True when the final file genuinely has to be produced by ffmpeg. */
export function needsRender(
  p: Pick<RenderPlan, 'soundtrack' | 'musicPath' | 'trim' | 'aspect' | 'overlay'>,
): boolean {
  if (p.soundtrack && p.musicPath) return true;
  if (p.trim) return true;
  if (p.aspect && p.aspect !== 'original') return true;
  if (p.overlay) return true;
  return false;
}

/** Output dimensions after the aspect crop (no upscaling — crop only). */
export function croppedSize(
  aspect: AspectRatio,
  width: number,
  height: number,
): { width: number; height: number } {
  const w = Math.max(2, Math.floor(width));
  const h = Math.max(2, Math.floor(height));
  let cw = w;
  let ch = h;
  if (aspect === '9:16') {
    cw = Math.min(w, Math.floor((h * 9) / 16));
    ch = Math.min(h, Math.floor((w * 16) / 9));
  } else if (aspect === '1:1') {
    cw = Math.min(w, h);
    ch = Math.min(w, h);
  } else if (aspect === '16:9') {
    cw = Math.min(w, Math.floor((h * 16) / 9));
    ch = Math.min(h, Math.floor((w * 9) / 16));
  }
  // libx264 needs even dimensions.
  cw = Math.max(2, cw - (cw % 2));
  ch = Math.max(2, ch - (ch % 2));
  return { width: cw, height: ch };
}

function cropExpr(aspect: AspectRatio, width: number, height: number): string | null {
  if (aspect === 'original') return null;
  const { width: cw, height: ch } = croppedSize(aspect, width, height);
  if (cw === Math.floor(width) && ch === Math.floor(height)) return null;
  // Crop from the centre — object-cover semantics, no distortion.
  return `crop=${cw}:${ch}`;
}

const r3 = round3;

/**
 * The exact ffmpeg invocation for a render. Pure and side-effect free so the
 * tests can assert the whole graph: inputs, crop, drawtext (via a text FILE,
 * so seller text is never interpolated into the filter string), volume,
 * fades, loop and the mix duration rule.
 *
 * Audio graph invariants:
 *   • `amix=duration=first` with the ORIGINAL audio first ⇒ the output is
 *     exactly as long as the (trimmed) video, music stops with it unless the
 *     seller enabled loop — and even then the video's length wins;
 *   • a source without an audio track gets an `anullsrc` bed so the graph is
 *     identical either way (music mixes against silence, never "no stream").
 */
export function buildMixArgs(p: RenderPlan): string[] {
  const trim = p.trim ?? null;
  const startIn = trim ? trim.startSeconds : 0;
  const outDur = trim
    ? round3(trim.endSeconds - trim.startSeconds)
    : Math.max(0.1, round3(p.durationSeconds));

  const args: string[] = ['-y', '-hide_banner', '-loglevel', 'error'];
  if (startIn > 0.001) args.push('-ss', String(startIn));
  args.push('-i', p.videoPath);

  const withMusic = !!(p.soundtrack && p.musicPath);
  if (withMusic) {
    if (p.soundtrack!.loop) args.push('-stream_loop', '-1');
    args.push('-i', p.musicPath!);
    if (!p.videoHasAudio) {
      args.push(
        '-f', 'lavfi',
        '-t', String(outDur),
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      );
    }
  }

  // ── video chain ──
  const vFilters: string[] = [];
  const crop = cropExpr(p.aspect ?? 'original', p.width, p.height);
  if (crop) vFilters.push(crop);
  if (crop || p.overlay) vFilters.push('scale=trunc(iw/2)*2:trunc(ih/2)*2');

  if (p.overlay && p.textFilePath) {
    const out = croppedSize(p.aspect ?? 'original', p.width, p.height);
    const font = Math.max(18, Math.min(64, Math.round(out.height / 22)));
    const border = Math.max(2, Math.round(font / 10));
    const margin = Math.round(out.height * 0.07);
    const y =
      p.overlay.position === 'bottom'
        ? out.height - font - margin
        : margin;
    vFilters.push(
      `drawtext=textfile=${p.textFilePath}:fontcolor=white:fontsize=${font}:borderw=${border}:bordercolor=black@0.75:x=(w-text_w)/2:y=${y}`,
    );
  }

  args.push('-map', '0:v');
  if (vFilters.length > 0) args.push('-filter:v', vFilters.join(','));

  // ── audio chain ──
  if (withMusic) {
    const st = p.soundtrack!;
    const musicDur = p.musicDurationSeconds ?? 0;
    const s = r3(Math.max(0, st.startSeconds));
    const played = st.loop
      ? outDur
      : musicDur > 0
        ? Math.min(outDur, Math.max(0.1, r3(musicDur - s)))
        : outDur;

    const mFilters = [
      `atrim=start=${s}`,
      'asetpts=PTS-STARTPTS',
      `volume=${r3(st.musicVolume)}`,
    ];
    if (st.fadeInSeconds > 0) {
      mFilters.push(`afade=t=in:st=0:d=${r3(Math.min(st.fadeInSeconds, played / 2))}`);
    }
    if (st.fadeOutSeconds > 0 && played > st.fadeOutSeconds + 0.1) {
      mFilters.push(
        `afade=t=out:st=${r3(played - st.fadeOutSeconds)}:d=${r3(st.fadeOutSeconds)}`,
      );
    }
    const origIndex = p.videoHasAudio ? 0 : 2;
    const origFilters = [`volume=${r3(st.muteOriginal ? 0 : st.originalVolume)}`];

    args.push(
      '-filter_complex',
      [
        `[${origIndex}:a]${origFilters.join(',')}[orig]`,
        `[1:a]${mFilters.join(',')}[music]`,
        '[orig][music]amix=inputs=2:duration=first:dropout_transition=0[aout]',
      ].join(';'),
      '-map', '[aout]',
    );
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');
  } else {
    if (p.videoHasAudio) args.push('-map', '0:a?', '-c:a', 'copy');
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p');
  }

  args.push('-movflags', '+faststart', '-t', String(outDur), p.outPath);
  return args;
}

/** Single-frame poster extraction (with the EOF-safe fallback). */
export function buildPosterArgs(
  srcPath: string,
  atSeconds: number,
  outPath: string,
  maxWidth = 400,
): string[] {
  const at = Math.max(0, round3(atSeconds));
  return [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', String(at),
    '-i', srcPath,
    '-vframes', '1',
    `-vf`, `scale='min(${maxWidth},iw)':-2`,
    '-q:v', '4',
    outPath,
  ];
}