'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Tag, ArrowRight, Video, Target, Locate, Filter, Search, Megaphone, Sparkles, BrainCircuit, Zap } from 'lucide-react';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

// High-fidelity Mock Data for Frontend-Only Pipeline
export const MOCK_REQUESTS = [
  {
    id: 'req_1',
    title: 'Need Professional Video Lighting Kit',
    description: 'Looking for a complete ring light or softbox setup for a new studio. Budget is around 15k. Must include tripod and phone holder. Prefer local pickup in Nairobi.',
    category: 'Electronics & Gadgets',
    minBudget: 12000,
    maxBudget: 18000,
    deadline: 'Urgent',
    area: 'Westlands',
    county: 'Nairobi',
    requestType: 'video',
    videoUrl: 'https://picsum.photos/seed/lighting/600/400',
    offersCount: 4,
    aiInsight: 'HIGH INTENT',
    aiMatch: '98%',
    aiReason: 'Buyer is ready to pay now. Matches your inventory.'
  },
  {
    id: 'req_2',
    title: 'Bulk Order: Cotton T-Shirts (50 pcs)',
    description: 'Need 50 plain white heavy cotton t-shirts for a corporate event. Various sizes (M, L, XL). High quality fabric only.',
    category: 'Fashion & Apparel',
    minBudget: 25000,
    maxBudget: 40000,
    deadline: 'Within 3 Days',
    area: 'CBD',
    county: 'Nairobi',
    requestType: 'text',
    videoUrl: null,
    offersCount: 12,
    aiInsight: 'VOLUME ORDER',
    aiMatch: '85%',
    aiReason: 'Potential for recurring business.'
  },
  {
    id: 'req_3',
    title: 'Gaming Laptop for Student',
    description: 'Looking for a reliable pre-owned gaming laptop (RTX 3060+) for architecture software. Budget is flexible if the machine is clean.',
    category: 'Electronics & Gadgets',
    minBudget: 60000,
    maxBudget: 85000,
    deadline: 'Flexible',
    area: 'Juja',
    county: 'Kiambu',
    requestType: 'text',
    videoUrl: null,
    offersCount: 2,
    aiInsight: 'PERFECT MATCH',
    aiMatch: '99%',
    aiReason: 'You have a listing that fits these specs exactly.'
  }
];

function LeadCard({ request }: { request: any }) {
  return (
    <Card className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] flex flex-col relative h-full shadow-2xl">
      <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          <span className="text-[9px] font-black text-primary uppercase tracking-widest">{request.aiInsight}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BrainCircuit className="h-3 w-3 text-white/40" />
          <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Match: {request.aiMatch}</span>
        </div>
      </div>

      <div className="relative aspect-video w-full bg-black overflow-hidden border-b border-white/5">
        {request.requestType === 'video' ? (
          <div className="relative w-full h-full">
            <Image src={request.videoUrl} alt="video" fill className="object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl">
                <Video className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950">
            <Megaphone className="h-12 w-12 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
      </div>

      <CardHeader className="p-6 pb-2">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
            {request.category}
          </Badge>
        </div>
        <CardTitle className="text-xl font-black uppercase tracking-tight line-clamp-2 group-hover:text-primary transition-colors leading-tight text-white">
          {request.title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6 flex-1 space-y-6">
        <p className="text-sm text-neutral-400 font-medium leading-relaxed line-clamp-2 italic bg-black/20 p-3 rounded-xl border border-white/5">
          "{request.description}"
        </p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-1 shadow-inner">
          <p className="text-[8px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
            <Zap className="h-2.5 w-2.5 fill-primary" /> Why this lead?
          </p>
          <p className="text-[11px] font-bold text-neutral-300 leading-tight">
            {request.aiReason}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-0.5 shadow-sm">
            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Budget</p>
            <p className="text-xs font-black text-white">KES {request.minBudget.toLocaleString()} - {request.maxBudget.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-0.5 shadow-sm">
            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Fulfillment</p>
            <p className="text-xs font-black text-white uppercase">{request.deadline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {request.area}, {request.county}
        </div>
      </CardContent>
      
      <CardFooter className="p-6 pt-0">
        <Button className="w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-xl shadow-primary/10 bg-primary hover:bg-primary/90 text-white border-none" asChild>
          <Link href={`/seller/send-offer/${request.id}`}>
            Send Offer <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function SellerRequestsMarketplacePage() {
  const [searchTerm, setSearchQuery] = useState('');
  const { toast } = useToast();

  const filtered = MOCK_REQUESTS.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SellerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">Marketplace Leads</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Direct inquiries from active buyers • <span className="text-primary">AI Powered</span></p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-xl">
              <div className="text-right">
                <p className="text-[8px] font-black uppercase text-primary tracking-widest">Active Leads</p>
                <p className="text-xl font-black text-white">{filtered.length}</p>
              </div>
              <div className="h-8 w-px bg-primary/20" />
              <Target className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search keywords or categories..." 
              className="pl-12 h-14 bg-neutral-900 border-white/5 rounded-2xl shadow-xl text-white"
              value={searchTerm}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/5 bg-neutral-900 shadow-xl font-black uppercase text-[10px] tracking-widest text-white">
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
          <Button 
            variant="secondary" 
            className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-blue-600/10 text-blue-400 border-blue-500/20"
            onClick={() => toast({ title: "Scanning Location...", description: "Filtering leads near your current area." })}
          >
            <Locate className="mr-2 h-4 w-4" /> Nearby Leads
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.length > 0 ? (
            filtered.map((request) => (
              <LeadCard key={request.id} request={request} />
            ))
          ) : (
            <div className="col-span-full py-24 text-center bg-neutral-900/30 rounded-[3rem] border-2 border-dashed border-white/5">
              <Megaphone className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-neutral-500 font-black uppercase tracking-widest text-xs">No matching leads found.</p>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}