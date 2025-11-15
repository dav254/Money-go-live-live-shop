import type { Seller } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';
import Link from 'next/link';

interface VideoInfoProps {
  seller: Seller;
  viewers: number;
}

export function VideoInfo({ seller, viewers }: VideoInfoProps) {
  return (
    <div className="absolute top-4 left-4 z-20 flex items-center gap-3 bg-black/40 p-2 rounded-xl backdrop-blur-sm">
      <Link href={`/sellers/${seller.id}`}>
        <Avatar className="h-10 w-10 border-2 border-white">
          <AvatarImage src={seller.avatar.imageUrl} alt={seller.name} data-ai-hint={seller.avatar.imageHint} />
          <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="text-sm">
        <Link href={`/sellers/${seller.id}`} className="font-headline font-bold text-white hover:underline">
          {seller.name}
        </Link>
        <div className="text-xs text-gray-200 flex items-center gap-2 mt-1">
          <Badge variant="destructive" className="h-5 text-xs font-bold">LIVE</Badge>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{viewers.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" className="ml-2 bg-transparent text-white border-white hover:bg-white/20 hover:text-white h-8">
        + Follow
      </Button>
    </div>
  );
}
