
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, query, collection, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { BuyerRequest, Offer } from '@/lib/types';
import { MapPin, Clock, Tag, ArrowLeft, CheckCircle, Video, MessageSquare, User, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export default function RequestOffersPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestRef = useMemoFirebase(() => doc(firestore, 'requests', id), [firestore, id]);
  const { data: request, isLoading: isRequestLoading } = useDoc<BuyerRequest>(requestRef);

  const offersQuery = useMemoFirebase(() => {
    return query(
      collection(firestore, 'offers'),
      where('requestId', '==', id),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, id]);

  const { data: offers, isLoading: areOffersLoading } = useCollection<Offer>(offersQuery);

  const handleAcceptOffer = async (offer: Offer) => {
    if (!firestore || !request) return;
    
    toast({ title: "Selecting Winner...", description: "Connecting you with the seller." });

    try {
      // 1. Update Request Status
      await updateDoc(requestRef, {
        status: 'selected',
        selectedSellerId: offer.sellerId,
        updatedAt: serverTimestamp()
      });

      // 2. Mark offer as accepted
      const offerRef = doc(firestore, 'offers', offer.id);
      await updateDoc(offerRef, { status: 'accepted' });

      // 3. Create initial conversation
      const conversationId = `${id}_${offer.sellerId}`;
      const msgRef = collection(firestore, 'conversations', conversationId, 'messages');
      await addDoc(msgRef, {
        senderId: 'system',
        text: `The buyer has accepted your offer of KES ${offer.price.toLocaleString()}! You can now chat to finalize the details.`,
        timestamp: serverTimestamp()
      });

      toast({ title: "Seller Accepted!", description: "Opening your secure negotiation chat." });
      router.push(`/chat/${conversationId}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    }
  };

  const isLoading = isRequestLoading || areOffersLoading;

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </BuyerLayout>
    );
  }

  if (!request) {
     return <BuyerLayout><div className="p-8 text-center"><h2 className="text-xl font-bold">Request not found</h2></div></BuyerLayout>;
  }

  return (
    <BuyerLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em]" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Needs
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Original Request Summary */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-neutral-900 border-white/5 sticky top-24">
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge className="bg-primary/20 text-primary uppercase font-black text-[8px] tracking-widest">{request.category}</Badge>
                  <Badge variant="outline" className={cn("uppercase text-[8px] font-black", request.status === 'open' ? "text-green-500 border-green-500/20" : "text-blue-500 border-blue-500/20")}>
                    {request.status}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter">{request.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium leading-relaxed">{request.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {request.videoUrl && (
                  <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                    <video src={request.videoUrl} controls className="w-full h-full" />
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-primary">
                    <Tag className="h-4 w-4" />
                    KES {request.minBudget.toLocaleString()} - {request.maxBudget.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <MapPin className="h-4 w-4" />
                    {request.area}, {request.county}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-neutral-400">
                    <Clock className="h-4 w-4" />
                    Deadline: {request.deadline}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Seller Offers */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Competitive Offers</h2>
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">{offers?.length || 0} PROPOSALS</p>
            </div>

            <div className="grid gap-4">
              {offers?.map((offer) => (
                <Card key={offer.id} className={cn(
                  "bg-neutral-950 border-white/5 overflow-hidden transition-all",
                  offer.status === 'accepted' ? "ring-2 ring-primary border-primary/20 shadow-2xl shadow-primary/10" : "hover:border-white/20"
                )}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-shrink-0 flex flex-col items-center gap-2">
                        <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-xl">
                          <AvatarImage src={offer.sellerAvatar} />
                          <AvatarFallback className="bg-neutral-800 text-lg font-black uppercase">{offer.sellerName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-green-500/30 text-green-500 bg-green-500/5">Verified Seller</Badge>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-black text-lg uppercase tracking-tight leading-none mb-1">{offer.sellerName}</h4>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Pitched {offer.createdAt?.toDate ? formatDistanceToNow(offer.createdAt.toDate(), { addSuffix: true }) : 'Now'}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-2xl font-black text-primary leading-none">KES {offer.price.toLocaleString()}</p>
                             <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mt-1">Delivery: {offer.deliveryTime}</p>
                          </div>
                        </div>

                        <p className="text-sm text-neutral-300 leading-relaxed bg-white/5 p-4 rounded-2xl italic">
                          "{offer.message}"
                        </p>

                        <div className="flex justify-end gap-3 pt-2">
                          {offer.status === 'accepted' ? (
                            <Button className="rounded-xl font-black uppercase text-xs px-8 h-12 bg-primary hover:bg-primary/90 text-white" asChild>
                              <Link href={`/chat/${request.id}_${offer.sellerId}`}>
                                <MessageSquare className="mr-2 h-4 w-4" /> CONTINUE CHAT
                              </Link>
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" className="rounded-xl font-bold uppercase text-[10px] tracking-widest text-neutral-500 hover:text-white h-12 px-6">DECLINE</Button>
                              <Button 
                                onClick={() => handleAcceptOffer(offer)}
                                className="rounded-xl font-black uppercase text-xs px-8 h-12 bg-white text-black hover:bg-neutral-200"
                                disabled={request.status !== 'open'}
                              >
                                {request.status === 'open' ? 'ACCEPT & CHAT' : 'REQUEST CLOSED'}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!offers || offers.length === 0) && (
                <div className="py-20 text-center bg-neutral-900/20 rounded-3xl border border-dashed border-white/5">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4 opacity-50" />
                  <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Waiting for sellers to compete for your order...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BuyerLayout>
  );
}

const Badge = ({ children, variant = 'default', className }: any) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
    variant === 'default' ? "bg-primary text-primary-foreground" : "bg-neutral-800 text-neutral-300",
    className
  )}>
    {children}
  </span>
);

function formatDistanceToNow(date: Date, options: { addSuffix: boolean }) {
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}
