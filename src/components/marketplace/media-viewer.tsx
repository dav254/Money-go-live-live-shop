'use client';

import * as React from 'react';
import { privateMediaUrl } from '@/lib/requests/client';
import { Play, X, ChevronLeft, ChevronRight, FileVideo } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Media viewer (spec §30): request/offer attachments open in a clean
 * in-app viewer. Images paginate; videos play in the built-in Vidnov
 * player with native controls — media is streamed, never auto-downloaded.
 */

export interface ViewableMedia {
  mediaId: string;
  type: 'image' | 'video';
  originalName?: string;
}

interface MediaViewerGridProps {
  media: ViewableMedia[];
  /** Small tile grid — the "ATTACHMENTS" strip inside request details. */
  layout?: 'grid' | 'strip';
  className?: string;
}

export function MediaViewerGrid({ media, layout = 'grid', className }: MediaViewerGridProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  if (media.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          layout === 'grid' ? 'grid grid-cols-3 sm:grid-cols-4 gap-3' : 'flex gap-3 overflow-x-auto pb-1',
          className,
        )}
      >
        {media.map((m, i) => (
          <button
            key={m.mediaId}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={cn(
              'group relative overflow-hidden rounded-xl border bg-muted/60 transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              layout === 'grid' ? 'aspect-square' : 'h-24 w-24 shrink-0',
            )}
            aria-label={m.type === 'video' ? 'Play video' : 'View image'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={privateMediaUrl(m.mediaId, true)}
              alt={m.originalName || (m.type === 'video' ? 'Video attachment' : 'Image attachment')}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            {m.type === 'video' && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition group-hover:scale-110">
                  <Play className="h-4 w-4 text-white" />
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <MediaLightbox media={media} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  );
}

interface MediaLightboxProps {
  media: ViewableMedia[];
  startIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ media, startIndex, onClose }: MediaLightboxProps) {
  const [index, setIndex] = React.useState(startIndex);
  const current = media[index];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, media.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media.length, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-bold uppercase tracking-widest text-white/70">
          {current.originalName || (current.type === 'video' ? 'Video' : 'Image')} · {index + 1} / {media.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {media.length > 1 && (
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {current.type === 'video' ? (
          <div className="flex max-h-full w-full max-w-3xl flex-col items-center gap-2">
            <video
              key={current.mediaId}
              src={privateMediaUrl(current.mediaId)}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="max-h-[70vh] w-full rounded-2xl bg-black shadow-2xl"
            />
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
              <FileVideo className="h-3 w-3" /> Vidnov Player
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={privateMediaUrl(current.mediaId)}
            alt={current.originalName || 'Attachment'}
            className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        )}

        {media.length > 1 && (
          <button
            type="button"
            aria-label="Next"
            onClick={() => setIndex((i) => Math.min(i + 1, media.length - 1))}
            disabled={index === media.length - 1}
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
