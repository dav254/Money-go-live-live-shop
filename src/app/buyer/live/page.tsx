
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { Heart, Search, Send, ShoppingCart, Video } from 'lucide-react';
import React from 'react';

function BuyerLiveView() {
  const products = [
    {
      id: 1,
      name: 'Summer Vibes T-Shirt',
      price: 10,
      image: 'https://picsum.photos/seed/liveprod1/300',
    },
    {
      id: 2,
      name: 'Wireless Earphones',
      price: 25,
      image: 'https://picsum.photos/seed/liveprod2/300',
    },
    {
      id: 3,
      name: 'Classic Leather Watch',
      price: 150,
      image: 'https://picsum.photos/seed/liveprod3/300',
    },
  ];

  const chatMessages = [
    { user: 'John', text: 'Is it available in blue?' },
    { user: 'Seller', text: 'Yes we have! ✅' },
    { user: 'Mary', text: 'How long for delivery?' },
  ];

  return (
    <div className="bg-neutral-950 text-white h-full flex flex-col">
      {/* Live Seller Stream */}
      <div className="p-3">
        <div className="bg-black rounded-lg overflow-hidden relative">
          <video
            className="w-full h-[400px] object-cover"
            src="https://cdn.coverr.co/videos/coverr-a-woman-in-a-black-hat-looks-at-the-camera-5645/1080p.mp4"
            controls
            autoPlay
            loop
            muted
          />
          <div className="absolute top-2 left-2 flex items-center gap-2 text-xs">
            <span className="bg-red-600 px-2 py-1 rounded-md font-bold">🔴 LIVE</span>
            <span className="bg-black/60 px-2 py-1 rounded-md">👁 1,023 Watching</span>
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-2 text-xs">
            <span className="bg-black/60 px-2 py-1 rounded-md flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-400" /> 309
            </span>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="p-3 space-y-4 bg-neutral-900">
        <h3 className="font-bold text-red-500">Seller Products</h3>
        <ScrollArea className="h-64">
            <div className="space-y-3 pr-4">
            {products.map((item) => (
                <div key={item.id} className="bg-neutral-800 p-3 rounded-lg flex items-start gap-3">
                    <Image
                    src={item.image}
                    alt={item.name}
                    width={80}
                    height={80}
                    className="rounded-md object-cover"
                    />
                    <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-red-500 font-bold">${item.price}</div>
                        <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="secondary">
                            Add to Cart
                        </Button>
                        <Button size="sm" variant="default" className="bg-red-600 hover:bg-red-700">
                            Buy Now
                        </Button>
                        </div>
                    </div>
                </div>
            ))}
            </div>
        </ScrollArea>
      </div>

      {/* Live Chat */}
      <div className="mt-auto bg-black border-t border-gray-800 p-2">
        <div className="text-sm h-32 overflow-y-auto space-y-2 mb-2 p-2 bg-neutral-900 rounded-md">
          {chatMessages.map((msg, index) => (
            <div key={index}>
              <span className="font-bold text-neutral-400">{msg.user}:</span>{' '}
              <span>{msg.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Type message..."
            className="flex-1 bg-neutral-900 p-2 rounded-md text-white outline-none border-neutral-700"
          />
          <Button variant="default" className="bg-red-600 hover:bg-red-700 px-4 rounded-md">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}


export default function BuyerLiveSectionPage() {
    return (
        <BuyerLayout>
            <div className="p-0 -m-4 sm:-m-6 h-[calc(100vh-4rem)]">
                <BuyerLiveView />
            </div>
        </BuyerLayout>
    );
}

