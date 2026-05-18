
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tag, Loader2, ArrowLeft, Send, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';

export default function SendOfferPage() {
  const params = useParams();
  const requestId = params.requestId as string;
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requestRef = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return doc(firestore, 'requests', requestId);
  }, [firestore, requestId]);

  const { data: request, isLoading } = useDoc<BuyerRequest>(requestRef);

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Placeholder for offer submission
    setTimeout(() => {
        toast({ title: 'Pitch Sent Successfully! 🚀', description: 'The buyer has been notified of your offer.' });
        setIsSubmitting(false);
        router.push('/seller/offers');
    }, 1500);
  };

  if (isLoading) return <SellerLayout><div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div></SellerLayout>;

  return (
    <SellerLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em] text-white/50 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Market
        </Button>

        <Card className="bg-neutral-900/50 border-white/5 overflow-hidden rounded-[2.5rem] shadow-2xl">
          <CardHeader className="p-8 pb-6 border-b border-white/5">
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">LIVE LEAD</span>
            </div>
            <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-tight text-white">{request?.title || 'Unknown Requirement'}</CardTitle>
          </CardHeader>
          
          <form onSubmit={handleSendOffer}>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="price" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Your Price Pitch (USD)</Label>
                    <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                    <Input
                        id="price"
                        type="number"
                        placeholder="e.g., 150"
                        className="pl-12 h-14 bg-white/5 rounded-2xl border-white/10 text-lg font-black text-white shadow-inner"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                    />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="message" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Message to Buyer</Label>
                    <Textarea
                        id="message"
                        rows={5}
                        placeholder="Tell the buyer why you're the best fit..."
                        className="bg-white/5 rounded-2xl border-white/10 text-sm font-medium leading-relaxed text-white shadow-inner"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                    />
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-8 pt-0">
              <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/30 border-none" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Send className="mr-2 h-6 w-6" />}
                SUBMIT PITCH
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </SellerLayout>
  );
}
