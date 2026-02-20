
'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Verified, Star, MapPin, Radio } from 'lucide-react';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import Link from 'next/link';

interface VideoInfoProps {
  seller: Seller | null;
}

export function VideoInfo({ seller }: VideoInfoProps) {
  if (!seller) {
    return (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10 pt-16">
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

  const avatarUrl = (seller.avatar?.imageUrl && seller.avatar.imageUrl !== "") 
    ? seller.avatar.imageUrl 
    : getPlaceholderImage();

  return (
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10 pt-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/sellers/${seller.id}`} className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary shadow-lg group">
            {avatarUrl && (
              <Image
                src={avatarUrl}
                alt={seller.name || 'Seller Avatar'}
                fill
                className="object-cover group-hover:scale-110 transition-transform"
                data-ai-hint={seller.avatar?.imageHint || 'seller avatar'}
              />
            )}
            {seller.isLive && (
                <div className="absolute inset-0 border-2 border-red-500 rounded-full animate-pulse" />
            )}
          </Link>
          <div>
            <div className="flex items-center gap-2">
                <Link href={`/sellers/${seller.id}`} className="font-bold text-white text-lg drop-shadow-md hover:underline">{seller.name || 'Seller Store'}</Link>
                {seller.isVerified && <Verified className="h-4 w-4 text-blue-400 fill-current shadow-sm" />}
                {seller.isLive && (
                    <Link href={`/buyer/live/${seller.id}`}>
                        <Badge className="bg-red-600 hover:bg-red-700 animate-pulse text-[10px] px-1.5 py-0 h-4 border-none">LIVE</Badge>
                    </Link>
                )}
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
        
        {seller.isLive && (
            <Button asChild size="sm" variant="destructive" className="rounded-full h-8 font-bold text-xs bg-red-600 hover:bg-red-700 shadow-lg">
                <Link href={`/buyer/live/${seller.id}`}>
                    <Radio className="mr-1.5 h-3.5 w-3.5" />
                    WATCH LIVE
                </Link>
            </Button>
        )}
      </div>
    </div>
  );
}
