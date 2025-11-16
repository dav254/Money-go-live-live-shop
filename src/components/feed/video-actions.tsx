'use client';

import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, ShoppingBag, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface VideoActionsProps {
  initialLikes: number;
  onProductClick: () => void;
  onScroll: (direction: 'up' | 'down') => void;
}

export function VideoActions({ initialLikes, onProductClick, onScroll }: VideoActionsProps) {
  const [likes, setLikes] = useState(initialLikes);

  const handleLike = () => {
    setLikes((prev) => prev + 1);
    // You can also add animation logic here
  };

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={() => onScroll('up')}>
          <ChevronUp className="h-6 w-6 text-white" />
        </Button>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={handleLike}>
          <Heart className="h-6 w-6 text-white fill-transparent" />
        </Button>
        <span className="text-sm font-semibold text-white drop-shadow-md">{likes}</span>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
          <Share2 className="h-6 w-6 text-white" />
        </Button>
      </div>
       <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-primary h-12 w-12 hover:bg-primary/80" onClick={onProductClick}>
          <ShoppingBag className="h-6 w-6 text-primary-foreground" />
        </Button>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
          <Star className="h-6 w-6 text-white" />
        </Button>
      </div>
       <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={() => onScroll('down')}>
          <ChevronDown className="h-6 w-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
