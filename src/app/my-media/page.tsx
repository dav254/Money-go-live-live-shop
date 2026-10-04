'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Smartphone, CloudUpload, Globe, Sparkles, Plus, Film, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * MY MEDIA — the user-facing view of the Vidnov storage system.
 * Every item shows clearly where it lives: PHONE ONLY, BACKED UP
 * (optimized copy on the VPS) or PUBLISHED (visible on the marketplace).
 * AI generations from AI Studio land here too.
 */

type MediaTab = 'all' | 'images' | 'videos' | 'ai' | 'drafts' | 'published';

const TABS: { id: MediaTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'videos', label: 'Videos' },
  { id: 'ai', label: 'AI' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'published', label: 'Published' },
];

type StorageState = 'phone' | 'backed-up' | 'published';

function StorageBadge({ state }: { state: StorageState }) {
  if (state === 'published') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em]">
        <Globe className="h-3 w-3" /> Published
      </span>
    );
  }
  if (state === 'backed-up') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <CloudUpload className="h-3 w-3" /> Backed up
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      <Smartphone className="h-3 w-3" /> Phone only
    </span>
  );
}

export default function MyMediaPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [tab, setTab] = useState<MediaTab>('all');

  // Published media = user's product media that is live on the marketplace.
  const productsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid), limit(24));
  }, [firestore, user]);
  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  const items = (products || []).map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    hasVideo: !!p.videoUrl,
    isAi: false,
    published: true,
  }));

  const filtered = items.filter((item) => {
    if (tab === 'images') return !item.hasVideo;
    if (tab === 'videos') return item.hasVideo;
    if (tab === 'ai') return item.isAi;
    if (tab === 'drafts') return false;
    if (tab === 'published') return item.published;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="container max-w-6xl mx-auto px-4 py-10 md:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">MY MEDIA</p>
          <div className="flex flex-wrap items-end justify-between gap-6 mt-4">
            <h1 className="font-grotesk text-3xl md:text-4xl font-bold text-foreground">Your library</h1>
            <div className="flex gap-3">
              <Button asChild variant="outline" className="h-11 px-6 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em]">
                <Link href="/dashboard/seller/ai-studio">
                  <Sparkles className="mr-2 h-4 w-4 text-accent" /> Create with AI
                </Link>
              </Button>
              <Button asChild className="h-11 px-6 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em]">
                <Link href="/dashboard/products?tab=add-new">
                  <Plus className="mr-2 h-4 w-4" /> Upload
                </Link>
              </Button>
            </div>
          </div>

          {/* Storage legend */}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 pt-6 border-t border-border">
            <span className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5" /> Phone only — private until published
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-2">
              <CloudUpload className="h-3.5 w-3.5" /> Backed up — optimized copy stored on Vidnov
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" /> Published — visible on the marketplace
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-5 py-4 text-[12px] font-semibold uppercase tracking-[0.18em] border-b-2 vn-transition whitespace-nowrap',
                  tab === t.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="container max-w-6xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="vn-skeleton aspect-[4/5] rounded-lg" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <div key={item.id} className="group">
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden border border-border bg-card vn-shadow">
                  <Image
                    src={item.imageUrl || 'https://placehold.co/400x500/141414/333333?text=—'}
                    alt={item.name || 'Media item'}
                    fill
                    className="object-cover vn-mono-img group-hover:scale-[1.03] vn-transition"
                  />
                  {item.hasVideo && (
                    <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur px-2.5 py-1">
                      <Film className="h-3 w-3 text-white" />
                      <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white">Video</span>
                    </span>
                  )}
                  {item.isAi && (
                    <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1">
                      <Sparkles className="h-3 w-3 text-black" />
                      <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-black">AI</span>
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <StorageBadge state="published" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Intentional empty state */
          <div className="py-24 text-center max-w-md mx-auto">
            <div className="h-14 w-14 mx-auto rounded-lg border border-border flex items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-grotesk text-xl font-semibold text-foreground mt-7">No creations yet</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Create your first image or video with Vidnov AI Studio, or upload product media directly.
            </p>
            <Button asChild className="mt-8 h-12 px-8 rounded-lg text-[11px] font-semibold uppercase tracking-[0.18em]">
              <Link href="/dashboard/seller/ai-studio">Create now</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
