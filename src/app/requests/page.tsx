
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Tag, ArrowRight, Video, Target, Locate, Filter, Search, Megaphone, Sparkles, BrainCircuit, Zap } from 'lucide-react';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Input } from '@/components/ui/input';

const MOCK_LEADS = [
  {
    id: 'req_1',
    title: 'Need Professional Video Lighting Kit',
    description: 'Looking for a ring light and softbox set for a home studio setup.',
    category: 'Electronics',
    minBudget: 8000,
    maxBudget: 15000,
    area: 'Westlands, Nairobi',
    deadline: 'urgent',
    match: '98%'
  },
  {
    id: 'req_2',
    title: '10 Bags of Cement',
    description: 'Bamburi or Savannah cement. Need delivered to site.',
    category: 'Construction',
    minBudget: 7500,
    maxBudget: 9000,
    area: 'Syokimau, Machakos',
    deadline: 'flexible',
    match: '92%'
  },
  {
    id: 'req_3',
    title: 'Vintage Leather Handbag',
    description: '90s style tote in brown leather.',
    category: 'Fashion',
    minBudget: 3000,
    maxBudget: 5000,
    area: 'Nyali, Mombasa',
    deadline: '3-days',
    match: '85%'
  }
];

function LeadCard({ request }: { request: typeof MOCK_LEADS[0] }) {
  return (
    <Card className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group overflow-hidden rounded-[2rem] flex flex-col relative h-full shadow-2xl">
      <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          <span className="text-[9px] font-black text-primary uppercase tracking-widest">HIGH INTENT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <BrainCircuit className="h-3 w-3 text-white/40" />
          <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Match: {request.match}</span>
        </div>
      </div>

      <CardHeader className="p-6 pb-2">
        <div className="flex justify-between items-start mb-4">
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
            {request.category}
          </Badge>
          {request.deadline === 'urgent' && <Badge className="bg-red-600 text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5 animate-pulse">URGENT</Badge>}
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
            <p className="text-xs font-black text-white">KES {request.minBudget.toLocaleString()} - {request.maxBudget.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-0.5 shadow-sm">
            <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Urgency</p>
            <p className="text-xs font-black text-white uppercase">{request.deadline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {request.area}
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
  return (
    <SellerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white leading-none">Marketplace Leads</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Direct requirements from buyers • <span className="text-primary">AI Matched</span></p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-3 flex items-center gap-4 shadow-xl">
              <div className="text-right">
                <p className="text-[8px] font-black uppercase text-primary tracking-widest">Active Leads</p>
                <p className="text-xl font-black text-white">{MOCK_LEADS.length}</p>
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
              className="pl-12 h-14 bg-neutral-900 border-white/5 rounded-2xl shadow-xl text-white"
            />
          </div>
          <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/5 bg-neutral-900 shadow-xl font-black uppercase text-[10px] tracking-widest text-white">
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_LEADS.map((request) => (
                <LeadCard key={request.id} request={request} />
            ))}
        </div>
      </div>
    </SellerLayout>
  );
}
