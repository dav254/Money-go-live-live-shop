'use client';

import * as React from 'react';
import Image from 'next/image';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FolderOpen,
  Download,
  Play,
  Image as ImageIcon,
  Video as VideoIcon,
  Store,
  Inbox,
  FileText,
  Sparkles,
} from 'lucide-react';

/**
 * MY MEDIA (spec §15 media library) — every upload a user makes or an AI
 * generation they store lands in the `media` collection with their uid.
 * This page groups it into folders (like Instagram Saved / TikTok
 * Favorites) and lets them save files to their phone (download button).
 */

interface MediaDoc {
  id: string;
  userId: string;
  type: 'image' | 'video';
  status?: string;
  isPrivate?: boolean;
  postId?: string | null;
  requestId?: string | null;
  offerId?: string | null;
  storagePath?: string;
  thumbnailPath?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalName?: string;
  createdAt?: unknown;
}

type FolderKey = 'all' | 'images' | 'videos' | 'requests' | 'offers' | 'posts';

const FOLDERS: { key: FolderKey; label: string; icon: React.ElementType; hint: string }[] = [
  { key: 'all', label: 'All media', icon: FolderOpen, hint: 'Everything you own' },
  { key: 'images', label: 'Images', icon: ImageIcon, hint: 'Photos & AI images' },
  { key: 'videos', label: 'Videos', icon: VideoIcon, hint: 'Clips & AI videos' },
  { key: 'requests', label: 'Requests', icon: Inbox, hint: 'Attached to your requests' },
  { key: 'offers', label: 'Offers', icon: Store, hint: 'Attached to your offers' },
  { key: 'posts', label: 'Posts & AI', icon: Sparkles, hint: 'Feed posts & creations' },
];

function fmtBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function MyMediaPage() {
  const { user, isLoading: authLoading } = useUser();
  const firestore = useFirestore();
  const [folder, setFolder] = React.useState<FolderKey>('all');

  const mediaQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    // Rules: media read allowed when resource.data.userId == uid.
    return query(
      collection(firestore, 'media'),
      where('userId', '==', user.uid),
      limit(200),
    );
  }, [user, firestore]);

  const { data: media, isLoading } = useCollection<MediaDoc>(mediaQuery);

  const ready = React.useMemo(
    () => (media ?? []).filter((m) => m.status === 'READY' && m.storagePath),
    [media],
  );

  const inFolder = React.useMemo(() => {
    switch (folder) {
      case 'images': return ready.filter((m) => m.type === 'image');
      case 'videos': return ready.filter((m) => m.type === 'video');
      case 'requests': return ready.filter((m) => !!m.requestId);
      case 'offers': return ready.filter((m) => !!m.offerId);
      case 'posts': return ready.filter((m) => !m.requestId && !m.offerId);
      default: return ready;
    }
  }, [ready, folder]);

  const countFor = (key: FolderKey): number => {
    switch (key) {
      case 'images': return ready.filter((m) => m.type === 'image').length;
      case 'videos': return ready.filter((m) => m.type === 'video').length;
      case 'requests': return ready.filter((m) => !!m.requestId).length;
      case 'offers': return ready.filter((m) => !!m.offerId).length;
      case 'posts': return ready.filter((m) => !m.requestId && !m.offerId).length;
      default: return ready.length;
    }
  };

  const thumbUrl = (m: MediaDoc) =>
    m.thumbnailPath ? `/api/media/file/${m.thumbnailPath}` : `/api/media/file/${m.storagePath}`;
  const fileUrl = (m: MediaDoc) => `/api/media/file/${m.storagePath}`;

  if (authLoading) {
    return (
      <BuyerLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="mx-auto max-w-5xl space-y-8 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Media Library</p>
            <h1 className="font-grotesk text-3xl font-black uppercase tracking-tight">My Media</h1>
            <p className="text-sm font-medium text-muted-foreground">
              Your uploads and AI creations — organized in folders, ready to save to your phone.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-bold">
            {ready.length} files
          </Badge>
        </header>

        {/* FOLDERS */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {FOLDERS.map((f) => {
            const active = folder === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFolder(f.key)}
                className={`group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left vn-transition ${
                  active
                    ? 'border-primary/60 bg-primary/5 shadow-md shadow-primary/10'
                    : 'border-border bg-card hover:border-primary/30'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    active ? 'vn-grad-coral text-white' : 'bg-muted text-muted-foreground group-hover:text-primary'
                  }`}
                >
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="font-grotesk text-sm font-bold text-foreground">{f.label}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {countFor(f.key)} items
                </span>
              </button>
            );
          })}
        </div>

        {/* GRID */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your media…
          </div>
        )}

        {!isLoading && inFolder.length === 0 && (
          <div className="rounded-2xl border border-dashed py-16 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 font-grotesk text-lg font-black uppercase">This folder is empty</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Media you upload to posts, requests and offers — plus AI Studio creations — appears
              here automatically.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {inFolder.map((m) => (
            <div
              key={m.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card vn-transition hover:border-primary/40"
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                {m.type === 'image' ? (
                  <Image
                    src={thumbUrl(m)}
                    alt={m.originalName || 'Media'}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <>
                    <Image
                      src={thumbUrl(m)}
                      alt={m.originalName || 'Video'}
                      fill
                      unoptimized
                      className="object-cover opacity-80"
                    />
                    <span className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur">
                      <Play className="h-4 w-4 text-white" />
                    </span>
                  </>
                )}
                {m.isPrivate && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white backdrop-blur">
                    Private
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {m.originalName || m.id.slice(0, 10)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{fmtBytes(m.sizeBytes)}</p>
                </div>
                {/* Save to phone */}
                <a
                  href={fileUrl(m)}
                  download={m.originalName || `vidnov-${m.id}.${m.type === 'image' ? 'webp' : 'mp4'}`}
                  aria-label="Save to phone"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground vn-transition hover:border-primary/40 hover:text-primary"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <FileText className="h-3 w-3" />
          Private media (requests/offers) stays protected — only matched businesses can view it,
          but you can always download your own files.
        </p>
      </div>
    </BuyerLayout>
  );
}
