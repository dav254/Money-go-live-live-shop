'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Verified, Star, MapPin } from 'lucide-react';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface VideoInfoProps {
  seller: Seller | null;
}

export function VideoInfo({ seller }: VideoInfoProps) {
  if (!seller) {
    return (
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10 pt-16">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-muted-foreground/50 rounded-md animate-pulse" />
            <div className="h-3 w-16 bg-muted-foreground/30 rounded-md mt-1 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl =
    seller.avatar?.imageUrl && seller.avatar.imageUrl !== '' ? seller.avatar.imageUrl : getPlaceholderImage();

  return (
    <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10 pt-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/sellers/${seller.id}`}
            className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary shadow-lg group"
          >
            {avatarUrl && (
              <Image
                src={avatarUrl}
                alt={seller.name || 'Seller Avatar'}
                fill
                className="object-cover group-hover:scale-110 transition-transform"
                data-ai-hint={seller.avatar?.imageHint || 'seller avatar'}
              />
            )}
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/sellers/${seller.id}`} className="font-bold text-white text-lg drop-shadow-md hover:underline">
                {seller.name || 'Seller Store'}
              </Link>
              {seller.isVerified && <Verified className="h-4 w-4 text-blue-400 fill-current shadow-sm" />}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">
              {'In stock · Nairobi'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary shadow-lg group">
              {avatarUrl && (
                <Image
                  src={avatarUrl}
                  alt={seller.name || 'Seller Avatar'}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform"
                  data-ai-hint={seller.avatar?.imageHint || 'seller avatar'}
                />
              )}
            </div>
            <Button className="text-xs bg-purple-600 text-white hover:bg-purple-700 border-0">Follow</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
