
import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Share2, MessageSquare, CheckCircle } from 'lucide-react';

interface SellerHeaderProps {
  seller: Seller;
}

export function SellerHeader({ seller }: SellerHeaderProps) {
  return (
    <div className="relative w-full">
      <div className="relative h-48 w-full md:h-64">
        <Image
          src={seller.banner.imageUrl}
          alt={`${seller.name}'s banner`}
          fill
          className="object-cover"
          data-ai-hint={seller.banner.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>
      <div className="relative -mt-12 px-4 md:px-8">
        <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left">
          <Avatar className="h-20 w-20 border-4 border-background md:h-28 md:w-28">
            <AvatarImage src={seller.avatar.imageUrl} alt={seller.name} data-ai-hint={seller.avatar.imageHint} />
            <AvatarFallback>{seller.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="mt-4 md:ml-6 md:mt-0">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <h1 className="font-headline text-3xl font-bold">{seller.name}</h1>
              {seller.isVerified && <CheckCircle className="h-6 w-6 text-primary" />}
            </div>
            <div className="mt-1 flex items-center justify-center gap-4 text-muted-foreground md:justify-start">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold">{seller.rating}</span>
                <span>({seller.reviewsCount.toLocaleString()} reviews)</span>
              </div>
              <span className="font-semibold">{seller.followers.toLocaleString()} Followers</span>
            </div>
          </div>
          <div className="mt-4 flex w-full gap-2 md:ml-auto md:mt-0 md:w-auto">
            <Button className="flex-1 md:flex-initial">Follow</Button>
            <Button variant="secondary" className="flex-1 md:flex-initial">
              <MessageSquare className="mr-2 h-4 w-4" /> Message
            </Button>
            <Button variant="ghost" size="icon">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-center text-muted-foreground md:text-left">{seller.bio}</p>
      </div>
    </div>
  );
}
