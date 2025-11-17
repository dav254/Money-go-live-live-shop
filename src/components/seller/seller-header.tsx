
import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SellerBadges } from './seller-badges'; // Import the new badges component
import { Star, Share2, MessageCircle, CheckCircle } from 'lucide-react';

interface SellerHeaderProps {
  seller: Seller;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  return (
    <div className="relative w-full text-white">
      {/* Banner Image */}
      <div className="relative h-48 w-full md:h-64">
        <Image
          src={seller.banner.imageUrl}
          alt={`${seller.name}'s banner`}
          fill
          className="object-cover"
          data-ai-hint={seller.banner.imageHint}
          priority // Eager load the largest image
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative -mt-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
          
          {/* Avatar */}
          <Avatar className="h-24 w-24 border-4 border-background md:h-32 md:w-32">
            <AvatarImage src={seller.avatar.imageUrl} alt={seller.name} data-ai-hint={seller.avatar.imageHint} />
            <AvatarFallback>{seller.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>

          {/* Seller Info */}
          <div className="mt-4 md:ml-6 md:mt-0">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{seller.name}</h1>
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-neutral-300 md:justify-start">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold">{seller.rating}</span>
                <span>({seller.reviewsCount.toLocaleString()})</span>
              </div>
              <span className="font-semibold">{seller.followers.toLocaleString()} Followers</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full flex-wrap justify-center gap-2 md:ml-auto md:mt-0 md:w-auto md:flex-nowrap">
            <Button className="flex-1 bg-white text-black hover:bg-neutral-200 md:flex-initial font-bold">Follow</Button>
            <Button variant="outline" className="flex-1 border-neutral-700 bg-black/50 hover:bg-neutral-800 md:flex-initial font-bold">
              <MessageCircle className="mr-2 h-4 w-4" /> Chat
            </Button>
            <Button variant="ghost" size="icon" className="hover:bg-neutral-800">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Bio and Badges */}
        <div className="mt-6 max-w-4xl mx-auto md:mx-0">
            <p className="text-center text-neutral-300 md:text-left">{seller.bio}</p>
            <SellerBadges seller={seller} />
        </div>
      </div>
    </div>
  );
}
