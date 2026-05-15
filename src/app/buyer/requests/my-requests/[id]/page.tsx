'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Tag, ArrowLeft, CheckCircle, Video, MessageSquare, User, Loader2, Sparkles, BrainCircuit, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Mock Data for the Pipeline Detail Page
const MOCK_LEAD_DETAIL = {
    id: 'req_1',
    title: 'Professional Video Lighting Kit',
    description: 'Looking for a complete ring light or softbox setup for a new studio. Budget is around 15k. Must include tripod and phone holder. Prefer local pickup in Nairobi.',
    category: 'Electronics & Gadgets',
    minBudget: 12000,
    maxBudget: 18000,
    area: 'Westlands',
    county: 'Nairobi',
    deadline: 'Urgent',
    status: 'open',
    videoUrl: 'https://picsum.photos/seed/lighting/600/400'
};

const MOCK_OFFERS = [
  {
    id: 'off_1',
    sellerName: "Aisha's Tech Shop",
    sellerAvatar: "https://picsum.photos/seed/aisha/100/100",
    price: 14500,
    message: "I have the 18-inch LED Ring Light in stock with a 2-meter tripod. High color accuracy (CRI 95+), perfect for your new studio. Can deliver to Westlands in 30 minutes!",
    deliveryTime: "Immediate (30 mins)",
    status: 'pending',
    match: "99%",
    reason: "Local seller & urgent delivery"
  },
  {
    id: 'off_2',
    sellerName: "Gadget World Nairobi",
    sellerAvatar: "https://picsum.photos/seed/gadget/100/100",
    price: 13000,
    message: "We have a professional softbox kit (set of 2) with high-quality bulbs. It fits perfectly within your budget. Includes a 1-year warranty.",
    deliveryTime: "Same Day",
    status: 'pending',
    match: "85%",
    reason: "Best price for softbox kits"
  }
];

export default function RequestOffersPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const handleAcceptOffer = (offer: typeof MOCK_OFFERS[0]) => {
    toast({ title: "Connecting with Seller...", description: `Opening secure chat with ${offer.sellerName}.` });
    
    // Simulate pipeline transition
    setTimeout(() => {
        router.push(`/messages`);
    }, 1500);
  };

  return (
    <BuyerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em] text-white/50 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Needs
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Original Request Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-neutral-900 border-white/5 sticky top-24 rounded-[2.5rem] shadow-2xl overflow-hidden">
              <CardHeader className="p-8 pb-4">
                <div className="flex justify-between items-start mb-4">
                  <Badge className="bg-primary/20 text-primary uppercase font-black text-[8px] tracking-widest border-none px-3 py-1 rounded-full">{MOCK_LEAD_DETAIL.category}</Badge>
                  <Badge variant="outline" className="uppercase text-[8px] font-black text-green-500 border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full">
                    LIVE
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter leading-none text-white">{MOCK_LEAD_DETAIL.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium leading-relaxed italic mt-2">"{MOCK_LEAD_DETAIL.description}"</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                {MOCK_LEAD_DETAIL.videoUrl && (
                  <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 shadow-inner group relative">
                    <img src={MOCK_LEAD_DETAIL.videoUrl} alt="lead" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-10 w-10 text-white/20" />
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <Tag className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">My Budget</p>
                        <p className="text-sm font-black text-white">KES {MOCK_LEAD_DETAIL.minBudget.toLocaleString()} - {MOCK_LEAD_DETAIL.maxBudget.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">My Location</p>
                        <p className="text-sm font-black text-white">{MOCK_LEAD_DETAIL.area}, {MOCK_LEAD_DETAIL.county}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Seller Offers */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between px-2">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">Competitive Pitches</h2>
                <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">{MOCK_OFFERS.length} Sellers waiting to fulfill your need</p>
              </div>
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>

            <div className="grid gap-6">
              {MOCK_OFFERS.map((offer) => (
                <Card key={offer.id} className="bg-neutral-950 border-white/5 overflow-hidden transition-all hover:border-primary/20 rounded-[2.5rem] shadow-2xl relative group">
                  <div className="bg-primary/10 border-b border-white/5 px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">AI Match: {offer.match}</span>
                    </div>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{offer.reason}</span>
                  </div>

                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-shrink-0 flex flex-col items-center gap-3">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-2xl">
                                <AvatarImage src={offer.sellerAvatar} />
                                <AvatarFallback className="bg-neutral-800 text-xl font-black uppercase">{offer.sellerName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-green-500 p-1.5 rounded-full border-4 border-neutral-950 shadow-xl">
                                <Star className="h-2.5 w-2.5 text-white fill-white" />
                            </div>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-green-500/20 text-green-500 bg-green-500/5 px-2 py-1 rounded-full">Top Seller</Badge>
                      </div>

                      <div className="flex-1 space-y-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-xl uppercase tracking-tight leading-none mb-1 text-white">{offer.sellerName}</h4>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Responded Today</p>
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
                           <Button variant="ghost" className="rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] text-neutral-500 hover:text-white h-14 px-8">DECLINE</Button>
                           <Button 
                             onClick={() => handleAcceptOffer(offer)}
                             className="rounded-2xl font-black uppercase text-xs tracking-widest px-10 h-14 bg-white text-black hover:bg-neutral-200 shadow-2xl border-none"
                           >
                             ACCEPT & START CHAT
                           </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
