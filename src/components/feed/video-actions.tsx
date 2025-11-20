
'use client';

import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, ShoppingBag, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface VideoActionsProps {
  initialLikes?: number;
  commentCount?: number;
  onProductClick?: () => void;
  onCommentClick?: () => void;
  onScroll?: (direction: 'up' | 'down') => void;
  onLike?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function VideoActions({ initialLikes = 0, commentCount = 0, onProductClick, onCommentClick, onScroll, onLike }: VideoActionsProps) {
  const [likes, setLikes] = useState(initialLikes);

  const handleLike = (e: React.MouseEvent<HTMLButtonElement>) => {
    setLikes((prev) => prev + 1);
    if (onLike) {
      onLike(e);
    }
  };

  const handleScrollClick = (direction: 'up' | 'down') => {
    if (typeof onScroll === 'function') {
      onScroll(direction);
    } else {
      console.error('[Studio Debug] onScroll prop is not a function in VideoActions');
    }
  };

  const handleProductClick = () => {
    if (typeof onProductClick === 'function') {
      onProductClick();
    }
  };
  
  const handleCommentClick = () => {
    if (typeof onCommentClick === 'function') {
      onCommentClick();
    }
  };

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={() => handleScrollClick('up')}>
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
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={handleCommentClick}>
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
        <span className="text-sm font-semibold text-white drop-shadow-md">{commentCount}</span>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
          <Share2 className="h-6 w-6 text-white" />
        </Button>
      </div>
       <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-primary h-12 w-12 hover:bg-primary/80" onClick={handleProductClick}>
          <ShoppingBag className="h-6 w-6 text-primary-foreground" />
        </Button>
      </div>
      <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70">
          <Star className="h-6 w-6 text-white" />
        </Button>
      </div>
       <div className="flex flex-col items-center">
        <Button size="icon" variant="ghost" className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70" onClick={() => handleScrollClick('down')}>
          <ChevronDown className="h-6 w-6 text-white" />
        </Button>
      </div>
    </div>
  );
}
