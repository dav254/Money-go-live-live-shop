'use client';

/**
 * Media picker — two honest sources: files on this device, and the user's
 * existing Vidnov media library (`/api/media/mine`, the Firestore/VPS index
 * of what they already uploaded). Nothing is duplicated: picking a library
 * item references its served URL; picking a device file hands the File to
 * the caller (which uses it locally and uploads it only on publish).
 */

import * as React from 'react';
import type { User } from 'firebase/auth';
import { X, Smartphone, FolderOpen, Loader2, AlertTriangle, Film, Music, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME } from '@/lib/media/config';
import { cn } from '@/lib/utils';

export interface LibraryItem {
  mediaId: string;
  type: string;
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

export interface MediaPickerProps {
  kind: 'video' | 'audio' | 'image';
  user: User | null;
  onClose: () => void;
  /** A file chosen from this device. */
  onPickFile: (file: File) => void;
  /** An item already in the Vidnov library (its served URL). */
  onPickUrl: (item: LibraryItem) => void;
}

const KIND_META = {
  video: { label: 'Video', icon: Film, accept: [...ALLOWED_VIDEO_MIME].join(','), types: ['video'] },
  audio: { label: 'Audio', icon: Music, accept: 'audio/*', types: ['audio'] },
  image: { label: 'Image', icon: ImageIcon, accept: [...ALLOWED_IMAGE_MIME].join(','), types: ['image'] },
} as const;

function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fmtDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function MediaPicker({ kind, user, onClose, onPickFile, onPickUrl }: MediaPickerProps) {
  const meta = KIND_META[kind];
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [tab, setTab] = React.useState<'library' | 'device'>('library');
  const [items, setItems] = React.useState<LibraryItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!user) {
      setItems([]);
      return () => { alive = false; };
    }
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/media/mine', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(res.status === 401 ? 'Session expired — sign in again.' : 'Could not load your media library.');
        const data = (await res.json()) as { files?: LibraryItem[] };
        if (!alive) return;
        const wanted = meta.types as readonly string[];
        setItems((data.files ?? []).filter((f) => wanted.includes(f.type) && Boolean(f.url)));
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Could not load your media library.');
        setItems([]);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <meta.icon className="h-4 w-4 text-emerald-400" /> Add {meta.label.toLowerCase()}
          </span>
          <button type="button" aria-label="Close picker" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-zinc-800">
          {(['library', 'device'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[12px] font-medium',
                tab === key ? 'border-b-2 border-emerald-400 text-emerald-300' : 'text-zinc-500',
              )}
            >
              {key === 'library' ? <FolderOpen className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
              My Media
            </button>
          ))}
        </div>

        <div className="min-h-[180px] flex-1 overflow-y-auto p-3">
          {tab === 'library' && (
            <>
              {items === null && (
                <p className="flex items-center justify-center gap-2 py-8 text-[12px] text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your library…
                </p>
              )}
              {items !== null && error && (
                <p className="flex gap-2 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error} You can still import from this device.
                </p>
              )}
              {items !== null && items.length === 0 && !error && (
                <p className="py-8 text-center text-[12px] text-zinc-500">
                  No {meta.label.toLowerCase()} in your Vidnov library yet — import from this device instead.
                </p>
              )}
              {items !== null && items.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {items.map((item) => (
                    <button
                      key={item.mediaId}
                      type="button"
                      onClick={() => { onPickUrl(item); onClose(); }}
                      className={cn(
                        'overflow-hidden rounded-lg border text-left transition-colors hover:border-emerald-500',
                        item.status === 'READY' ? 'border-zinc-800' : 'border-zinc-800 opacity-60',
                      )}
                    >
                      <div className="relative aspect-video bg-zinc-900">
                        {item.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-700"><meta.icon className="h-6 w-6" /></div>
                        )}
                        {item.durationSeconds !== null && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] tabular-nums text-zinc-200">
                            {fmtDuration(item.durationSeconds)}
                          </span>
                        )}
                        {item.status !== 'READY' && (
                          <span className="absolute left-1 top-1 rounded bg-amber-900/90 px-1 text-[9px] uppercase text-amber-200">
                            {item.status.toLowerCase()}
                          </span>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="truncate text-[11px] text-zinc-200">{item.originalName || item.mediaId}</p>
                        <p className="text-[10px] tabular-nums text-zinc-500">
                          {fmtSize(item.sizeBytes)}
                          {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'device' && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <meta.icon className="h-8 w-8 text-zinc-600" />
              <p className="max-w-[16rem] text-[12px] leading-relaxed text-zinc-400">
                Pick a {meta.label.toLowerCase()} file straight from this device. It stays on your phone while you
                edit; it only uploads to Vidnov when you publish or export.
              </p>
              <Button size="sm" variant="secondary" className="text-xs" onClick={() => fileRef.current?.click()}>
                Browse files
              </Button>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={meta.accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) { onPickFile(file); onClose(); }
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
