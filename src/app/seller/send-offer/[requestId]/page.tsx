
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, addDoc, collection, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import type { BuyerRequest, UserProfile } from '@/lib/types';
import { MapPin, Clock, Tag, Loader2, ArrowLeft, Send, CheckCircle, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function SendOfferPage() {
  const params = useParams();
  const requestId = params.requestId as string;
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('24 Hours');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestRef = useMemoFirebase(() => doc(firestore, 'requests', requestId), [firestore, requestId]);
  const { data: request, isLoading } = useDoc<BuyerRequest>(requestRef);

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore || !request) return;

    if (!price || !message) {
      toast({ variant: 'destructive', title: 'Missing details', description: 'Please provide a price and a message for your offer.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const offerData = {
        requestId,
        sellerId: user.uid,
        sellerName: user.displayName || 'Go Earn Seller',
        sellerAvatar: user.photoURL || '',
        price: Number(price),
        message,
        deliveryTime,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'offers'), offerData);
      
      // Increment offer count on request
      await updateDoc(requestRef, {
        offersCount: increment(1)
      });

      toast({ title: 'Offer Sent!', description: 'Your pitch has been submitted to the buyer.' });
      router.push('/seller/offers');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SellerLayout>
    );
  }

  if (!request) {
    return (
      <SellerLayout>
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold">Request not found</h2>
          <Button onClick={() => router.push('/requests')} className="mt-4">Back to Marketplace</Button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em]" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lead
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Request Details */}
          <div className="space-y-6">
            <Card className="bg-neutral-900/50 border-white/5 overflow-hidden">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Badge className="bg-primary/20 text-primary uppercase font-black text-[8px] tracking-widest">{request.category}</Badge>
                </div>
                <CardTitle className="text-2xl font-black uppercase tracking-tighter mt-4">{request.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium">{request.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {request.videoUrl && (
                  <div className="aspect-video w-full bg-black rounded-xl overflow-hidden border border-white/10">
                    <video src={request.videoUrl} controls className="w-full h-full" />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest mb-1">Budget Range</p>
                    <p className="text-sm font-bold text-primary">KES {request.minBudget.toLocaleString()} - {request.maxBudget.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest mb-1">Deadline</p>
                    <p className="text-sm font-bold text-white uppercase">{request.deadline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                  <MapPin className="h-4 w-4 text-primary" />
                  {request.area}, {request.county}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pitch Form */}
          <div className="space-y-6">
            <Card className="bg-neutral-950 border-primary/20 shadow-2xl shadow-primary/10">
              <CardHeader>
                <CardTitle className="text-xl font-black uppercase tracking-tighter">Send Your Offer</CardTitle>
                <CardDescription>Winning pitches are fast, clear, and competitively priced.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSendOffer}>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="uppercase text-[10px] font-black tracking-widest">Your Price (KES)</Label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                      <Input
                        id="price"
                        type="number"
                        placeholder="e.g. 1500"
                        className="pl-10 h-12 bg-white/5 rounded-xl border-white/10"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delivery" className="uppercase text-[10px] font-black tracking-widest">Delivery Time</Label>
                    <Input
                      id="delivery"
                      placeholder="e.g. Within 2 Hours"
                      className="h-12 bg-white/5 rounded-xl border-white/10"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="uppercase text-[10px] font-black tracking-widest">Pitch Message</Label>
                    <Textarea
                      id="message"
                      rows={5}
                      placeholder="Why should the buyer choose you? Mention your experience or specific solution."
                      className="bg-white/5 rounded-xl border-white/10"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    SEND PITCH NOW
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}

const Label = ({ children, className, ...props }: any) => (
  <label className={cn("block text-sm font-medium text-foreground", className)} {...props}>
    {children}
  </label>
);

const Badge = ({ children, variant = 'default', className }: any) => (
  <span className={cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
    variant === 'default' ? "bg-primary text-primary-foreground" : "bg-neutral-800 text-neutral-300",
    className
  )}>
    {children}
  </span>
);
