
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag, Clock, CheckCircle, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import type { Offer } from '@/lib/types';
import Link from 'next/link';

export default function SellerOffersPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const offersQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'offers'),
      where('sellerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);

  const { data: offers, isLoading } = useCollection<Offer>(offersQuery);

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Sent Pitches</h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest mt-1">Track the status of your marketplace offers</p>
        </div>

        <div className="grid gap-4">
          {offers?.map((offer) => (
            <Card key={offer.id} className="bg-neutral-900/50 border-white/5 hover:border-primary/20 transition-all">
              <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant={offer.status === 'accepted' ? 'default' : 'secondary'} className={offer.status === 'accepted' ? 'bg-green-600' : 'bg-neutral-800'}>
                      {offer.status === 'accepted' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                      {offer.status.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      Sent {offer.createdAt?.toDate ? offer.createdAt.toDate().toLocaleDateString() : 'Now'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg leading-tight truncate max-w-md">Pitch Message: "{offer.message}"</h3>
                  <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-tighter">
                    <div className="flex items-center gap-1 text-primary">
                      <Tag className="h-3.5 w-3.5" />
                      KES {offer.price.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-neutral-400">
                      <Clock className="h-3.5 w-3.5" />
                      {offer.deliveryTime}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <Button variant="outline" className="h-10 rounded-xl border-white/10 font-bold text-xs uppercase" asChild>
                    <Link href={`/requests`}>View Request</Link>
                  </Button>
                  {offer.status === 'accepted' && (
                     <Button className="h-10 rounded-xl bg-green-600 hover:bg-green-700 font-black text-xs uppercase" asChild>
                        <Link href={`/chat/${offer.requestId}_${offer.sellerId}`}>Start Chat <ArrowRight className="ml-2 h-4 w-4" /></Link>
                     </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(!offers || offers.length === 0) && (
             <div className="py-20 text-center bg-neutral-900/30 rounded-3xl border border-dashed border-white/10">
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">You haven't sent any pitches yet.</p>
                <Button variant="link" asChild className="mt-2 text-primary font-black uppercase text-[10px]">
                    <Link href="/requests">Browse Buyer Requests</Link>
                </Button>
             </div>
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
