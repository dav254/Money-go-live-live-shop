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
import type { BuyerRequest } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

const MOCK_REQUESTS: Partial<BuyerRequest>[] = [
  {
    id: 'req_1',
    buyerId: 'user_1',
    title: 'Need High-Performance Office Laptop',
    description: 'Looking for a laptop with at least 16GB RAM and i7 processor for architecture work. Budget is firm for the right specs.',
    category: 'Electronics & Gadgets',
    minBudget: 45000,
    maxBudget: 60000,
    currency: 'KES',
    country: 'Kenya',
    county: 'Nairobi',
    area: 'Westlands',
    requestType: 'text',
    contactMethod: 'chat',
    deadline: 'urgent',
    imageUrls: [],
    videoUrl: null,
    status: 'open',
    offersCount: 5,
    selectedSellerId: null,
    views: 142,
    createdAt: { toDate: () => new Date(Date.now() - 3600000) }, // 1 hour ago
  },
  {
    id: 'req_2',
    buyerId: 'user_2',
    title: 'Custom Handmade Leather Boots',
    description: 'I need durable, genuine leather boots size 42. Preferably dark brown with reinforced soles for hiking.',
    category: 'Fashion & Apparel',
    minBudget: 6500,
    maxBudget: 12000,
    currency: 'KES',
    country: 'Kenya',
    county: 'Kiambu',
    area: 'Thika',
    requestType: 'video',
    contactMethod: 'whatsapp',
    deadline: 'flexible',
    imageUrls: [],
    videoUrl: 'https://picsum.photos/seed/studio-video-demo/600/400', // Mock video URL
    status: 'open',
    offersCount: 2,
    selectedSellerId: null,
    views: 89,
    createdAt: { toDate: () => new Date(Date.now() - 86400000) }, // 1 day ago
  },
  {
    id: 'req_3',
    buyerId: 'user_3',
    title: 'Bulk Organic Honey Supply (50kg)',
    description: 'Looking for a reliable supplier for 50kg of pure, unrefined organic honey for my bakery business.',
    category: 'Food & Groceries',
    minBudget: 35000,
    maxBudget: 45000,
    currency: 'KES',
    country: 'Kenya',
    county: 'Nairobi',
    area: 'CBD',
    requestType: 'text',
    contactMethod: 'phone',
    deadline: '3-days',
    imageUrls: [],
    videoUrl: null,
    status: 'open',
    offersCount: 0,
    selectedSellerId: null,
    views: 24,
    createdAt: { toDate: () => new Date(Date.now() - 172800000) }, // 2 days ago
  },
  {
    id: 'req_4',
    buyerId: 'user_4',
    title: 'Modern Living Room Sofa Set',
    description: 'Seeking a 5-seater L-shaped sofa. Minimalist design, grey or navy blue color. Delivery to Kilimani required.',
    category: 'Home & Living',
    minBudget: 55000,
    maxBudget: 85000,
    currency: 'KES',
    country: 'Kenya',
    county: 'Nairobi',
    area: 'Kilimani',
    requestType: 'text',
    contactMethod: 'chat',
    deadline: 'flexible',
    imageUrls: ['https://picsum.photos/seed/sofa-req/600/400'],
    videoUrl: null,
    status: 'open',
    offersCount: 8,
    selectedSellerId: null,
    views: 210,
    createdAt: { toDate: () => new Date(Date.now() - 43200000) }, // 12 hours ago
  }
];

export default function SellerRequestsMarketplacePage() {
  const [searchTerm, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Filter local mock data instead of Firestore
  const filtered = (MOCK_REQUESTS as BuyerRequest[]).filter(r => 
    r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.description?.toLowerCase().includes(searchTerm.toLowerCase())
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
        <Card className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] flex flex-col relative h-full">
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
                    <div className="relative w-full h-full">
                        <Image src={request.videoUrl} alt={request.title} fill className="object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                                <Video className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </div>
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