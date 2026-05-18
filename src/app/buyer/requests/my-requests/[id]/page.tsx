
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Tag, ArrowLeft, Video, MessageSquare, User, Loader2, Sparkles, BrainCircuit, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { BuyerRequest, Offer } from '@/lib/types';
import { format } from 'date-fns';

export default function RequestOffersPage() {
  const params = useParams();
  const requestId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const requestRef = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return doc(firestore, 'requests', requestId);
  }, [firestore, requestId]);

  const { data: lead, isLoading: isLeadLoading } = useDoc<BuyerRequest>(requestRef);

  const offersQuery = useMemoFirebase(() => {
      if (!firestore || !requestId) return null;
      return query(collection(firestore, 'offers'), where('requestId', '==', requestId), orderBy('createdAt', 'desc'));
  }, [firestore, requestId]);

  const { data: offers, isLoading: areOffersLoading } = useCollection<Offer>(offersQuery);

  const handleAcceptOffer = async (offer: Offer) => {
    if (!firestore || !requestId) return;
    
    toast({ title: "Confirming Deal...", description: "Connecting your account to the verified seller." });
    
    try {
        await updateDoc(doc(firestore, 'requests', requestId), {
            status: 'selected',
            selectedSellerId: offer.sellerId,
            updatedAt: serverTimestamp()
        });
        
        toast({ title: "Deal Locked!", description: "Opening secure chat channel." });
        
        setTimeout(() => {
            router.push(`/messages?chatWith=${offer.sellerId}`);
        }, 1000);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Action Failed' });
    }
  };

  if (isLeadLoading) {
      return (
          <BuyerLayout>
              <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
          </BuyerLayout>
      )
  }

  if (!lead) {
      return (
          <BuyerLayout>
              <div className="p-8 text-center">
                  <h2 className="text-xl font-bold">Requirement not found.</h2>
                  <Button className="mt-4" onClick={() => router.push('/buyer/requests/my-requests')}>Back to My Needs</Button>
              </div>
          </BuyerLayout>
      )
  }

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
                  <Badge className="bg-primary/20 text-primary uppercase font-black text-[8px] tracking-widest border-none px-3 py-1 rounded-full">{lead.category}</Badge>
                  <Badge variant="outline" className="uppercase text-[8px] font-black text-green-500 border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full">
                    {lead.status.toUpperCase()}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter leading-none text-white">{lead.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium leading-relaxed italic mt-2">"{lead.description}"</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                {lead.videoUrl && (
                  <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 shadow-inner group relative">
                    <video src={lead.videoUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" controls />
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <Tag className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">My Budget</p>
                        <p className="text-sm font-black text-white">KES {lead.minBudget?.toLocaleString()} - {lead.maxBudget?.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">My Location</p>
                        <p className="text-sm font-black text-white">{lead.area}, {lead.county}</p>
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
                <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">{offers?.length || 0} Sellers waiting to fulfill your need</p>
              </div>
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>

            <div className="grid gap-6">
              {offers && offers.map((offer) => (
                <Card key={offer.id} className="bg-neutral-950 border-white/5 overflow-hidden transition-all hover:border-primary/20 rounded-[2.5rem] shadow-2xl relative group">
                  <div className="bg-primary/10 border-b border-white/5 px-8 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">AI Match detected</span>
                    </div>
                  </div>

                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-shrink-0 flex flex-col items-center gap-3">
                        <div className="relative">
                            <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-2xl">
                                <AvatarImage src={offer.sellerAvatar} />
                                <AvatarFallback className="bg-neutral-800 text-xl font-black uppercase">{offer.sellerId.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                      </div>

                      <div className="flex-1 space-y-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-xl uppercase tracking-tight leading-none mb-1 text-white">{offer.sellerName || 'Verified Seller'}</h4>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Responded {offer.createdAt?.toDate ? format(offer.createdAt.toDate(), 'PPP') : 'Recently'}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-3xl font-black text-primary leading-none tracking-tighter">KES {offer.price?.toLocaleString()}</p>
                             <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mt-1">Delivery: {offer.deliveryTime}</p>
                          </div>
                        </div>

                        {offer.videoUrl && (
                            <div className="aspect-video w-full max-w-sm bg-black rounded-2xl overflow-hidden border border-white/5 shadow-inner">
                                <video src={offer.videoUrl} className="h-full w-full object-cover" controls />
                            </div>
                        )}

                        <p className="text-base text-neutral-300 font-medium leading-relaxed bg-white/5 p-6 rounded-3xl italic border border-white/5 shadow-inner">
                          "{offer.message}"
                        </p>

                        <div className="flex justify-end gap-3 pt-2">
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

              {(!offers || offers.length === 0) && !areOffersLoading && (
                  <div className="py-24 text-center bg-neutral-900/30 rounded-[3rem] border-2 border-dashed border-white/5">
                      <p className="text-neutral-500 font-black uppercase tracking-widest text-xs">Waiting for sellers to pitch...</p>
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}
