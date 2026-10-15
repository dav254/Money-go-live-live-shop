
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductGrid } from "@/components/products/product-grid";
import { SellerInfo } from "./seller-info";
import type { Seller, Product, LiveSession } from "@/lib/types";
import {
  BusinessReviewsList,
  type PublicBusinessPayload,
} from "@/components/trust/business-trust-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "../ui/card";
import { Radio, Clock, Play, Video, History, ArrowRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

interface SellerTabsProps {
  seller: Seller;
  products: Product[];
  liveSession?: LiveSession | null;
  /**
   * The trust payload already fetched by the page.
   *
   * Passed in rather than re-fetched: the tab would otherwise ask the server
   * twice for the same review list, and two reads of a changing number is how
   * a score ends up disagreeing with itself on one page.
   */
  trust?: PublicBusinessPayload | null | undefined;
}

export function SellerTabs({ seller, products, liveSession, trust }: SellerTabsProps) {
  const videoProducts = products.filter(p => p.videoUrl || (p.videoUrls && p.videoUrls.length > 0));

  const isLive = liveSession?.status === 'live';
  const hasHistory = liveSession?.status === 'ended';

  return (
    <Tabs defaultValue="products" className="w-full">
      <TabsList className="sticky top-14 z-30 grid w-full grid-cols-5 rounded-none border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-sm md:w-fit md:rounded-lg">
        <TabsTrigger value="products">Products</TabsTrigger>
        <TabsTrigger value="videos">Videos</TabsTrigger>
        <TabsTrigger value="live" className="relative">
            Live
            {isLive && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
            )}
        </TabsTrigger>
        {/* The count is on the tab, not just inside it: a shopper deciding
            whether to trust a shop should not have to open Reviews to find out
            whether there are any. */}
        <TabsTrigger value="reviews" className="gap-1.5">
          Reviews
          {trust && trust.reviews.count > 0 && (
            <span className="text-[10px] font-bold text-amber-400">
              {trust.reviews.count}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
      </TabsList>
      
      <div className="mt-6">
        <TabsContent value="products">
          <ProductGrid products={products} />
        </TabsContent>

        <TabsContent value="videos">
          {videoProducts.length > 0 ? (
            <ProductGrid products={videoProducts} />
          ) : (
            <div className="flex items-center justify-center rounded-lg bg-neutral-900 p-12 text-center">
              <p className="text-neutral-400">This seller has not uploaded any videos yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="live" className="space-y-6">
          {isLive ? (
            <Card className="bg-neutral-900 border-red-500/50 shadow-2xl shadow-red-500/10 overflow-hidden">
                <div className="relative aspect-video md:aspect-[21/9] bg-black">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-25" />
                            <Video className="h-16 w-16 text-red-500 relative z-10" />
                        </div>
                    </div>
                    <div className="absolute top-4 left-4">
                        <Badge className="bg-red-600 hover:bg-red-700 animate-pulse border-none px-3 py-1 font-black uppercase tracking-widest text-xs">
                            <Radio className="mr-2 h-3 w-3" /> LIVE NOW
                        </Badge>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black p-6">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{liveSession?.title}</h3>
                        <p className="text-neutral-400 text-sm font-bold uppercase tracking-widest mt-1">Join thousands of viewers and shop real-time deals!</p>
                    </div>
                </div>
                <CardFooter className="bg-neutral-950 p-4 border-t border-white/5 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-8 w-8 rounded-full border-2 border-neutral-950 bg-neutral-800 overflow-hidden">
                                    <img src="/placeholder-avatar.svg" alt="user" className="h-full w-full object-cover opacity-50" />
                                </div>
                            ))}
                        </div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                            <span className="text-white">{(liveSession?.viewerCount || 0).toLocaleString()}</span> people watching
                        </p>
                    </div>
                    <Button size="lg" className="w-full sm:w-auto font-black bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-10 shadow-xl shadow-red-600/20" asChild>
                        <Link href={`/buyer/live/${seller.id}`}>
                            ENTER SHOW <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6">
                {hasHistory && (
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-neutral-800 flex items-center justify-center">
                                <History className="h-6 w-6 text-neutral-500" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Last Broadcast</CardTitle>
                                <CardDescription className="uppercase font-bold text-[10px] tracking-widest">
                                    {liveSession?.endTime?.toDate ? formatDistanceToNow(liveSession.endTime.toDate(), { addSuffix: true }) : 'Recently'}
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-neutral-400 leading-relaxed italic">
                                "{liveSession?.title}"
                            </p>
                        </CardContent>
                    </Card>
                )}
                
                <div className="flex flex-col items-center justify-center rounded-2xl bg-neutral-900 border-2 border-dashed border-neutral-800 p-12 text-center">
                    <div className="bg-neutral-800 p-4 rounded-full mb-4">
                        <Radio className="h-8 w-8 text-neutral-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">No Active Streams</h3>
                    <p className="text-neutral-500 max-w-xs mt-2 text-sm">Follow this shop to get notified the next time {seller.name} goes live!</p>
                    <Button variant="outline" className="mt-6 border-neutral-700 font-bold uppercase text-[10px] tracking-widest rounded-xl px-8">
                        Notify Me
                    </Button>
                </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="max-w-3xl">
          <BusinessReviewsList data={trust} />
        </TabsContent>

        <TabsContent value="about">
          <SellerInfo seller={seller} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
