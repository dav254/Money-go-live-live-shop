'use client';

import * as React from 'react';
import Image from 'next/image';

interface GalleryItem {
  id: number;
  src: string;
  alt: string;
  name?: string;
  tag?: string;
}

interface GalleryStripProps {
  items: readonly GalleryItem[];
  layout?: 'grid' | 'spotlight';
  className?: string;
}

export function GalleryStrip({ items, layout = 'grid', className }: GalleryStripProps) {
  if (!items.length) {
    return null;
  }

  if (layout === 'spotlight') {
    const [hero] = items;
    return (
      <div className={`relative overflow-hidden rounded-2xl border border-border bg-card vn-shadow ${className ?? ''}`}>
        <div className="aspect-[4/3] overflow-hidden">
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            className="object-cover transition-transform duration-500 hover:scale-105"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {hero.tag && (
            <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              {hero.tag}
            </span>
          )}
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-sm font-semibold text-white">{hero.name ?? 'Featured shop'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(items.length, 4)} ${className ?? ''}`}>
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative overflow-hidden rounded-2xl border border-border bg-card vn-shadow"
        >
          <div className="aspect-square overflow-hidden">
            <Image
              src={item.src}
              alt={item.alt}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            {item.tag && (
              <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                {item.tag}
              </span>
            )}
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
