
'use client';

import { useRequests } from '@/hooks/useRequests';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Tag, ArrowRight, Video } from 'lucide-react';
import Link from 'next/link';
import { SellerLayout } from '@/components/layout/seller-layout';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { useUserProfile, useUser } from '@/firebase';

export default function RequestsPage() {
  const { requests, loading } = useRequests();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);

  const Layout = userProfile?.role === 'seller' ? SellerLayout : BuyerLayout;

  if (loading) {
    return (
      <Layout>
        <div className="flex h-screen items-center justify-center">
          <p className="animate-pulse font-black uppercase tracking-widest text-primary">Scanning Marketplace...</p>
        </div>
      </Layout>
    );
  }

  const openRequests = requests.filter(r => r.status === 'open');

  return (
    <Layout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Marketplace Leads</h1>
            <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Browse what buyers need right now</p>
          </div>
          <Badge variant="outline" className="w-fit h-8 px-4 rounded-full border-primary/20 bg-primary/5 text-primary font-bold">
            {openRequests.length} Active Requests
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {openRequests.map((request) => (
            <Card key={request.id} className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-widest">
                    {request.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                    <Clock className="h-3 w-3" />
                    {request.deadline}
                  </div>
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                  {request.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-neutral-400 line-clamp-2 min-h-[40px]">
                  {request.description}
                </p>
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-tighter">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Tag className="h-3.5 w-3.5" />
                    KES {request.minBudget.toLocaleString()} - {request.maxBudget.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {request.area}, {request.county}
                  </div>
                </div>
                {request.videoUrl && (
                  <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    <Video className="h-3.5 w-3.5" />
                    Includes Video Request
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-0">
                <Button className="w-full font-black uppercase tracking-widest text-xs h-12 rounded-xl" asChild>
                  <Link href={`/seller/send-offer/${request.id}`}>
                    View Details & Pitch <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {openRequests.length === 0 && (
            <div className="col-span-full py-20 text-center bg-neutral-900/30 rounded-3xl border border-dashed border-white/10">
              <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">No active buyer requests found.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
