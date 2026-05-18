'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Tag, Loader2, ArrowLeft, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function SendOfferPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate real backend processing for offer submission
    setTimeout(() => {
        toast({ title: 'Pitch Sent Successfully! 🚀', description: 'The buyer has been notified of your offer.' });
        setIsSubmitting(false);
        router.push('/seller/offers');
    }, 1500);
  };

  return (
    <SellerLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em] text-white/50 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Market
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6 lg:sticky lg:top-24">
            <Card className="bg-neutral-900/50 border-white/5 overflow-hidden rounded-[2.5rem] shadow-2xl">
              <CardHeader className="p-8 pb-4">
                <Badge className="bg-primary/20 text-primary border-none text-[8px] font-black uppercase tracking-widest rounded-full mb-4 w-fit px-3 py-1">
                  Lead Requirement
                </Badge>
                <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-tight text-white">Requirement Overview</CardTitle>
                <CardDescription className="text-neutral-400 font-medium text-base mt-2 leading-relaxed italic">"Review the customer's needs carefully before pitching your price."</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Budget Window</p>
                    <p className="text-lg font-black text-primary">Competitive</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Delivery</p>
                    <p className="text-lg font-black text-white uppercase">Fast Track</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-black text-neutral-400 uppercase tracking-widest px-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Verified Buyer Request
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-neutral-950 border-primary/20 shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4 bg-primary/5 border-b border-white/5">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Draft Your Pitch</CardTitle>
                <CardDescription className="font-bold text-primary/60 text-xs uppercase tracking-widest">Submit your best offer to win this lead.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSendOffer}>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="price" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Your Price Pitch</Label>
                        <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                        <Input
                            id="price"
                            type="number"
                            placeholder="e.g., 12000"
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
                            placeholder="Tell the buyer why they should choose you..."
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
        </div>
      </div>
    </SellerLayout>
  );
}
