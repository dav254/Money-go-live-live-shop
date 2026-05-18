
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Tag, ArrowLeft, MessageSquare, Star, Sparkles, BrainCircuit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

const MOCK_OFFERS = [
    {
        id: 'off_1',
        sellerName: 'Ahmed Electronics',
        price: 12500,
        deliveryTime: 'Same Day',
        message: 'I have the high-CRI ring light set in stock. Can deliver to Westlands in 30 minutes!',
        rating: 4.8,
        matchScore: '98%',
        sellerAvatar: 'https://picsum.photos/seed/ Ahmed/100'
    },
    {
        id: 'off_2',
        sellerName: 'Global Studio Store',
        price: 9500,
        deliveryTime: '2 Days',
        message: 'Standard studio kit with 3 light modes. Shipped via G4S.',
        rating: 4.5,
        matchScore: '85%',
        sellerAvatar: 'https://picsum.photos/seed/Global/100'
    }
];

export default function RequestOffersPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleAcceptOffer = (sellerName: string) => {
    toast({
        title: "Offer Accepted! 🎉",
        description: `Connecting you to ${sellerName} via secure chat.`,
    });
    setTimeout(() => {
        router.push('/messages');
    }, 1500);
  };

  return (
    <BuyerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em] text-white/50 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Needs
        </Button>

        <div className="flex items-center justify-between px-2">
            <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">Competitive Pitches</h2>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Sellers waiting to fulfill your need</p>
            </div>
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
        </div>

        <div className="grid gap-6">
            {MOCK_OFFERS.map((offer) => (
            <Card key={offer.id} className="bg-neutral-950 border-white/5 overflow-hidden transition-all hover:border-primary/20 rounded-[2.5rem] shadow-2xl relative group">
                <div className="bg-primary/10 border-b border-white/5 px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">AI Match detected</span>
                </div>
                <Badge className="bg-green-600 font-black text-[9px] px-2 py-0.5 rounded-full border-none">{offer.matchScore} Match</Badge>
                </div>

                <CardContent className="p-8">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-shrink-0 flex flex-col items-center gap-3">
                    <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-2xl">
                        <AvatarImage src={offer.sellerAvatar} />
                        <AvatarFallback className="bg-neutral-800 text-xl font-black uppercase">{offer.sellerName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-xs font-black">{offer.rating}</span>
                    </div>
                    </div>

                    <div className="flex-1 space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                        <h4 className="font-black text-xl uppercase tracking-tight leading-none mb-1 text-white">{offer.sellerName}</h4>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Verified Professional Seller</p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black text-primary leading-none tracking-tighter">KES {offer.price.toLocaleString()}</p>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mt-1">Delivery: {offer.deliveryTime}</p>
                        </div>
                    </div>

                    <p className="text-base text-neutral-300 font-medium leading-relaxed bg-white/5 p-6 rounded-3xl italic border border-white/5 shadow-inner">
                        "{offer.message}"
                    </p>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button 
                        onClick={() => handleAcceptOffer(offer.sellerName)}
                        className="rounded-2xl font-black uppercase text-xs tracking-widest px-10 h-14 bg-white text-black hover:bg-neutral-200 shadow-2xl border-none"
                        >
                        ACCEPT & START DEAL
                        </Button>
                    </div>
                    </div>
                </div>
                </CardContent>
            </Card>
            ))}
        </div>
      </div>
    </BuyerLayout>
  );
}
