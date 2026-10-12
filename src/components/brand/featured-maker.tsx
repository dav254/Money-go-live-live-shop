'use client';

import * as React from 'react';

interface FeaturedMakerProps {
  cover: { src: string; alt: string };
  name: string;
  city?: string;
}

export function FeaturedMaker({ cover, name, city }: FeaturedMakerProps) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card vn-shadow">
      {/* cover */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={cover.src}
          alt={cover.alt}
          className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Featured maker
          </span>
        </div>
      </div>

      {/* body */}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-bold">
            {name.charAt(0)}
          </span>
          <div>
            <h3 className="font-grotesk text-base font-semibold text-foreground truncate">
              {name}
            </h3>
            {city && <p className="mt-0.5 text-xs text-muted-foreground">{city}</p>}
          </div>
        </div>
      </div>
    </article>
  );
}
