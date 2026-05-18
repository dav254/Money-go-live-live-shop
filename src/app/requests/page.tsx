'use client';

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Tag, ArrowRight, Target, Filter, Search, Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

function LeadCard({ request }: { request: BuyerRequest }) {
  return (
    <Card className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] flex flex-col relative h-full shadow-2xl">
      <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          <span className="text-[9px] font-black text-primary uppercase tracking-widest">LIVE BROADCAST</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BrainCircuit className="h-3 w-3 text-white/40" />
          <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Match Score Ready</span>
        </div>
      </div>

      <CardHeader className="p-6 pb-2">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
            {request.category}
          </Badge>
          <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5">
            {request.status}
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
        
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-0.5 shadow-sm">
            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Budget</p>
            <p className="text-xs font-black text-white">${request.minBudget?.toLocaleString()} - ${request.maxBudget?.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-0.5 shadow-sm">
            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Posted</p>
            <p className="text-[10px] font-black text-white uppercase">
                {request.createdAt?.toDate ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {request.area}, {request.county}
        </div>
      </CardContent>
      
      <CardFooter className="p-6 pt-0">
        <Button className="w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl bg-primary hover:bg-primary/90 text-white border-none shadow-lg shadow-primary/10" asChild>
          <Link href={`/seller/send-offer/${request.id}`}>
            SEND OFFER <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function SellerRequestsMarketplacePage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState('');

  const leadsQuery = useMemoFirebase(() => {
    return query(
        collection(firestore, 'requests'), 
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: leads, isLoading } = useCollection<BuyerRequest>(leadsQuery);

  const filteredLeads = React.useMemo(() => {
    if (!leads) return [];
    if (!searchTerm.trim()) return leads;
    return leads.filter(l => 
        l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leads, searchTerm]);

  return (
    <SellerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">Marketplace Leads</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Direct requirements from buyers • <span className="text-primary">Live Data</span></p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-xl">
              <div className="text-right">
                <p className="text-[8px] font-black uppercase text-primary tracking-widest">Available Now</p>
                <p className="text-xl font-black text-white">{leads?.length || 0}</p>
              </div>
              <Target className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Filter leads by keyword..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 bg-neutral-900 border-white/5 rounded-2xl shadow-xl text-white"
            />
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/5 bg-neutral-900 shadow-xl font-black uppercase text-[10px] tracking-widest text-white">
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>

        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => <Card key={i} className="h-[400px] bg-neutral-900/50 border-white/5 animate-pulse rounded-[2rem]" />)}
            </div>
        ) : filteredLeads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredLeads.map((request) => (
                    <LeadCard key={request.id} request={request} />
                ))}
            </div>
        ) : (
            <div className="py-20 text-center space-y-4 bg-neutral-900/20 rounded-[3rem] border border-dashed border-white/5">
                <Search className="h-12 w-12 text-neutral-700 mx-auto" />
                <h3 className="font-black uppercase tracking-widest text-neutral-500">No active leads found</h3>
                <p className="text-xs text-neutral-600 font-bold uppercase">Check back later for new customer broadcasts</p>
            </div>
        )}
      </div>
    </SellerLayout>
  );
}