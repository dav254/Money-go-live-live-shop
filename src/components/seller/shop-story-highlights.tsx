'use client';

import type { StoryHighlight } from '@/lib/types';

interface ShopStoryHighlightsProps {
  highlights: StoryHighlight[];
}

const defaultHighlights: StoryHighlight[] = [
  { id: '1', title: 'New Arrivals', imageUrl: '/placeholder.svg' },
  { id: '2', title: 'Offers', imageUrl: '/placeholder.svg' },
  { id: '3', title: 'Trending', imageUrl: '/placeholder.svg' },
  { id: '4', title: 'Best Sellers', imageUrl: '/placeholder.svg' },
  { id: '5', title: 'Live Replay', imageUrl: '/placeholder.svg' },
];

export function ShopStoryHighlights({ highlights = defaultHighlights }: ShopStoryHighlightsProps) {
  if (!highlights || highlights.length === 0) {
    return null;
  }

  return (
    <div className="py-6">
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {highlights.map(highlight => (
            <div key={highlight.id} className="flex flex-col items-center gap-2 cursor-pointer group flex-shrink-0">
                <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-yellow-400 to-red-500 p-0.5">
                    <div className="bg-neutral-900 p-0.5 rounded-full h-full w-full">
                         <img 
                            src={highlight.imageUrl} 
                            alt={highlight.title} 
                            className="h-full w-full object-cover rounded-full transition-transform duration-300 group-hover:scale-90"
                        />
                    </div>
                </div>
                <span className="text-xs font-semibold text-neutral-300 group-hover:text-white">{highlight.title}</span>
            </div>
        ))}
        </div>
    </div>
  );
}
