
'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Verified, Star, MapPin } from 'lucide-react';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface VideoInfoProps {
  seller: Seller | null;
}

export function VideoInfo({ seller }: VideoInfoProps) {
  if (!seller) {
    return (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse"></div>
                <div className="flex-1">
                    <div className="h-4 w-24 bg-muted-foreground/50 rounded-md animate-pulse"></div>
                    <div className="h-3 w-16 bg-muted-foreground/30 rounded-md mt-1 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
  }

  const avatarUrl = seller.avatar?.imageUrl || getPlaceholderImage();

  return (
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary shadow-lg">
            <Image
              src={avatarUrl}
              alt={seller.name || 'Seller Avatar'}
              fill
              className="object-cover"
              data-ai-hint={seller.avatar?.imageHint || 'seller avatar'}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-lg drop-shadow-md">{seller.name || 'Seller Store'}</h3>
                {seller.isVerified && <Verified className="h-4 w-4 text-blue-400 fill-current shadow-sm" />}
            </div>
            <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs text-neutral-200 drop-shadow-md">
                    <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-400 fill-current"/>
                        {seller.rating?.toFixed(1) || 'N/A'}
                    </span>
                    <span>|</span>
                    <span>{(seller.followers || 0).toLocaleString()} followers</span>
                </div>
                {seller.location && (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-primary-foreground/90 drop-shadow-md">
                        <MapPin className="h-3 w-3" />
                        <span>{seller.location}</span>
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
