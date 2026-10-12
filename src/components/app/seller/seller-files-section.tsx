'use client';

import * as React from 'react';
import type { User } from 'firebase/auth';
import {
  Clapperboard, FileWarning, Film, HardDrive, Image as ImageIcon, Loader2, RefreshCw,
} from 'lucide-react';
import { SellerCard } from '@/components/app/seller/seller-app-shell';
import { IMAGE_LIMITS } from '@/lib/media/limits';
import { cn } from '@/lib/utils';

/**
 * YOUR FILES (`/app/seller/account`).
 *
 * ## What this shows
 *
 * Every image and video this seller has uploaded, read from `/api/media/mine`
 * — which is the Firestore index of what is actually sitting on the VPS disk
 * under `/var/lib/vidnov/media`. Nothing here goes to Firebase Storage or any
 * other third party: the seller can see their files and their sizes because
 * the files are ours.
 *
 * ## Why the size shown is the compressed one
 *
 * `sizeBytes` is what the stored file weighs *after* the server re-encoded it
 * (WebP at `IMAGE_LIMITS.quality`, longest edge `maxDimension`; H.264 CRF 28
 * for video). Showing the compressed figure rather than the size of the file
 * on their phone is the honest number, and it is also the point of the whole
 * pipeline — it is what proves the compression is actually happening.
 *
 * ## This screen is read-only
 *
 * Deleting a file is deliberately not offered here: the same file may back a
 * live listing, a chat message or a request offer, and a delete that ignored
 * those references would break a live storefront. Files are removed through
 * the thing that owns them (the listing, the message).
 */

interface MediaFile {
  mediaId: string;
  type: 'image' | 'video';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  status: string;
  createdAtMs: number;
  url?: string;
  thumbnailUrl?: string;
}

interface MediaTotals {
  count: number;
  images: number;
  videos: number;
  totalBytes: number;
  truncated: boolean;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SellerFilesSection({ user }: { user: User | null }) {
  const [files, setFiles] = React.useState<MediaFile[] | null>(null);
  const [totals, setTotals] = React.useState<MediaTotals | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/media/mine', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(res.status === 401 ? 'Session expired.' : 'Could not load your files.');
        const data = await res.json();
        if (cancelled) return;
        setFiles(Array.isArray(data.files) ? data.files : []);
        setTotals(data.totals ?? null);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not load your files.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  const reload = () => setNonce((n) => n + 1);

  return (
    <section className="px-4">
      <SellerCard className="vn-app-card space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HardDrive className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Your files</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Every image and video you have uploaded, stored on our own server
              and compressed to save space. No external storage, no third-party
              quota.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            aria-label="Refresh your files"
            className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {totals && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Files', value: String(totals.count), icon: Clapperboard },
              { label: 'Images', value: String(totals.images), icon: ImageIcon },
              { label: 'On disk', value: formatBytes(totals.totalBytes), icon: HardDrive },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border/70 bg-background px-2 py-2.5 text-center"
              >
                <p className="font-grotesk text-sm font-bold tabular-nums text-foreground">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[11px] text-destructive">
            {error}
          </p>
        )}

        {!error && loading && (
          <p className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your files…
          </p>
        )}

        {!error && !loading && (files?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <FileWarning className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">Nothing uploaded yet</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Add a listing, or set a logo and banner above — everything you
              upload lands here. Images up to {IMAGE_LIMITS.maxUploadMb} MB, videos up to{' '}
              {Math.round(IMAGE_LIMITS.videoMaxUploadMb)} MB.
            </p>
          </div>
        )}

        {!error && !loading && (files?.length ?? 0) > 0 && (
          <>
            <ul className="grid grid-cols-3 gap-2.5">
              {(files ?? []).map((file) => (
                <li
                  key={file.mediaId}
                  className="overflow-hidden rounded-xl border border-border/70 bg-background"
                >
                  <div className="relative aspect-square w-full bg-secondary">
                    {file.type === 'image' && (file.thumbnailUrl || file.url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(file.thumbnailUrl || file.url) as string}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : file.type === 'video' ? (
                      <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Film className="h-5 w-5" />
                      </span>
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                        {file.status === 'FAILED' ? (
                          <FileWarning className="h-5 w-5 text-destructive" />
                        ) : (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        )}
                      </span>
                    )}
                    {file.status === 'FAILED' && (
                      <span className="absolute inset-x-0 bottom-0 bg-destructive/90 px-1 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-white">
                        Failed
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[10px] font-semibold text-foreground">
                      {file.originalName || (file.type === 'video' ? 'Video' : 'Image')}
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      {formatBytes(file.sizeBytes)}
                      {file.type === 'image' && file.width
                        ? ` · ${file.width}×${file.height}`
                        : ''}
                      {file.type === 'video' && formatDuration(file.durationSeconds)
                        ? ` · ${formatDuration(file.durationSeconds)}`
                        : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {totals?.truncated && (
              <p className="text-[11px] text-muted-foreground">
                Showing your most recent {files?.length} files.
              </p>
            )}
          </>
        )}
      </SellerCard>
    </section>
  );
}