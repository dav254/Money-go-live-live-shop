'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Tag, ArrowRight, Video, Target, Locate, Filter, Search, Megaphone, ImageIcon, Layers, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

export default function SellerRequestsMarketplacePage() {
  const [searchTerm, setSearchQuery] = useState('');
  const firestore = useFirestore();

  const requestsQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(
          collection(firestore, 'requests'),
          where('status', '==', 'open'),
          orderBy('createdAt', 'desc')
      );
  }, [firestore]);

  const { data: requests, isLoading } = useCollection<BuyerRequest>(requestsQuery);

  const filtered = (requests || []).filter(r => 
    r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SellerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Marketplace Leads</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Direct inquiries from active buyers</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-2 flex items-center gap-4 shadow-xl">
                 <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-primary tracking-widest">Active Needs</p>
                    <p className="text-xl font-black text-white">{isLoading ? '...' : filtered.length}</p>
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
            <Button variant="secondary" className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-blue-600/10 text-blue-400 border-blue-500/20">
                <Locate className="mr-2 h-4 w-4" /> Nearby Leads
            </Button>
        </div>

        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-xs font-black uppercase tracking-widest">Scanning Marketplace...</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.length > 0 ? (
                filtered.map((request) => (
                <LeadCard key={request.id} request={request} />
                ))
            ) : (
                <div className="col-span-full py-24 text-center bg-neutral-900/30 rounded-[3rem] border-2 border-dashed border-white/5">
                <Megaphone className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-neutral-500 font-black uppercase tracking-widest text-xs">No matching leads found at the moment.</p>
                </div>
            )}
            </div>
        )}
      </div>
    </SellerLayout>
  );
}

function LeadCard({ request }: { request: BuyerRequest }) {
    const mainThumbnail = request.imageUrls?.[0];

    return (
        <Card className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] flex flex-col relative">
            {request.requestType === 'video' ? (
                <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase tracking-widest rounded-full px-3 py-1 shadow-xl">
                        <Video className="h-3 w-3 mr-1" /> Video Request
                    </Badge>
                </div>
            ) : request.imageUrls?.length > 0 ? (
                <div className="absolute top-4 right-4 z-10">
                    <Badge className="bg-blue-600 text-white border-none text-[8px] font-black uppercase tracking-widest rounded-full px-3 py-1 shadow-xl">
                        <ImageIcon className="h-3 w-3 mr-1" /> {request.imageUrls.length} Images
                    </Badge>
                </div>
            ) : null}
            
            <div className="relative aspect-video w-full bg-black overflow-hidden border-b border-white/5">
                {request.videoUrl ? (
                    <video src={request.videoUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                ) : mainThumbnail ? (
                    <div className="relative w-full h-full">
                        <Image src={mainThumbnail} alt={request.title} fill className="object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-10">
                        <Layers className="h-16 w-16 text-white" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
            </div>

            <CardHeader className="p-8 pb-4">
                <Badge variant="outline" className="w-fit mb-4 text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                    {request.category}
                </Badge>
                <CardTitle className="text-xl font-black uppercase tracking-tight line-clamp-2 group-hover:text-primary transition-colors leading-tight text-white">
                    {request.title}
                </CardTitle>
                <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mt-1">
                    Posted {request.createdAt?.toDate ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                </p>
            </CardHeader>
            
            <CardContent className="px-8 flex-1 space-y-6">
                <p className="text-sm text-neutral-400 font-medium leading-relaxed line-clamp-2">
                    {request.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1 shadow-lg">
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Budget</p>
                        <p className="text-sm font-black text-white">KES {request.minBudget?.toLocaleString()} - {request.maxBudget?.toLocaleString()}</p>
                    </div>
                     <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1 shadow-lg">
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Deadline</p>
                        <p className="text-sm font-black text-white uppercase">{request.deadline}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {request.area}, {request.county}
                </div>
            </CardContent>
            
            <CardFooter className="p-8 pt-4">
                <Button className="w-full font-black uppercase tracking-widest text-xs h-14 rounded-2xl shadow-xl shadow-primary/10 bg-primary hover:bg-primary/90 text-white" asChild>
                    <Link href={`/seller/send-offer/${request.id}`}>
                        Send Offer <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    )
}