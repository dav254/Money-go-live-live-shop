'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag, Clock, CheckCircle, ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Mock Offers for Frontend-Only Pipeline
const MOCK_SENT_OFFERS = [
  {
    id: 'off_1',
    requestId: 'req_1',
    title: 'Need Professional Video Lighting Kit',
    price: 14500,
    message: 'I have this exact kit in stock. High-CRI ring light with 3 modes. Can deliver in 30 mins to Westlands!',
    status: 'pending',
    sentAt: '2 mins ago',
  },
  {
    id: 'off_2',
    requestId: 'req_3',
    title: 'Gaming Laptop for Student',
    price: 78000,
    message: 'ASUS ROG Strix G15, RTX 3060, 16GB RAM. Perfect for arch software. Very clean condition.',
    status: 'accepted',
    sentAt: '1 day ago',
  }
];

export default function SellerOffersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = React.useState<string | null>(null);

  const handleNegotiation = (offerId: string) => {
    setIsConnecting(offerId);
    toast({
        title: "Connecting with Buyer...",
        description: "Opening a secure negotiation channel for this deal.",
    });

    // Simulate pipeline transition to the messages page
    setTimeout(() => {
        router.push('/messages');
    }, 1500);
  };

  return (
    <SellerLayout>
      <div className="p-6 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Sent Pitches</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-2">Status of your marketplace inquiries</p>
          </div>
          <Button variant="ghost" className="uppercase font-black text-[10px] tracking-widest text-primary hover:text-primary/80" asChild>
            <Link href="/requests"><ArrowLeft className="mr-2 h-3.5 w-3.5" /> Back to Market</Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {MOCK_SENT_OFFERS.map((offer) => (
            <Card key={offer.id} className="bg-neutral-900/50 border-white/5 hover:border-primary/20 transition-all rounded-[2rem] overflow-hidden group">
              <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex items-center gap-3">
                    <Badge variant={offer.status === 'accepted' ? 'default' : 'secondary'} className={cn(
                        "uppercase font-black text-[9px] tracking-widest py-1 px-3 border-none",
                        offer.status === 'accepted' ? "bg-green-600 text-white" : "bg-neutral-800 text-neutral-400"
                    )}>
                      {offer.status === 'accepted' ? <CheckCircle className="h-3 w-3 mr-1.5" /> : <Clock className="h-3 w-3 mr-1.5" />}
                      {offer.status}
                    </Badge>
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      Sent {offer.sentAt}
                    </span>
                  </div>
                  
                  <div>
                    <h3 className="font-black text-lg uppercase tracking-tight text-white mb-1">{offer.title}</h3>
                    <p className="text-sm text-neutral-400 font-medium leading-relaxed italic line-clamp-2">"{offer.message}"</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-base font-black text-white">KES {offer.price.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
                  {offer.status === 'accepted' ? (
                     <Button 
                        disabled={isConnecting === offer.id}
                        onClick={() => handleNegotiation(offer.id)}
                        className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 text-white border-none"
                     >
                        {isConnecting === offer.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <MessageSquare className="mr-2 h-4 w-4" />
                        )}
                        {isConnecting === offer.id ? 'Connecting...' : 'Start Negotiation'}
                     </Button>
                  ) : (
                    <Button variant="outline" className="h-14 px-8 rounded-2xl border-white/10 font-black text-xs uppercase tracking-widest text-white hover:bg-white/5">
                        Withdraw Pitch
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SellerLayout>
  );
}
