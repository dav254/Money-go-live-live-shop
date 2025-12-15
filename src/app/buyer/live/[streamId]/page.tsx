
'use client';

import React from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { useParams } from 'next/navigation';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, VideoOff } from 'lucide-react';
import { LiveChat } from '@/components/buyer/LiveChat';
import { LiveProductCard } from '@/components/buyer/LiveProductCard';
import { products } from '@/lib/placeholder-data';


const BuyerLiveStreamPage = () => {
    const params = useParams();
    const playbackId = params.streamId as string;
    
    return (
        <BuyerLayout fullWidth={true}>
            <div className="h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-4 bg-black">
                
                {/* Main Video Section */}
                <div className="lg:col-span-3 h-full flex flex-col">
                    <div className="flex-1 w-full bg-black flex items-center justify-center relative overflow-hidden">
                       {playbackId ? (
                             <MuxPlayer
                                streamType="live"
                                playbackId={playbackId}
                                className="w-full h-full"
                                autoPlay
                                muted
                                placeholder={<div className="w-full h-full flex flex-col items-center justify-center bg-black text-white"><Loader2 className="h-8 w-8 animate-spin" /><p className="mt-2">Connecting to live stream...</p></div>}
                             />
                       ) : (
                           <div className="flex flex-col items-center justify-center text-white">
                               <VideoOff className="h-12 w-12 text-muted-foreground" />
                               <p className="mt-4">No stream ID provided.</p>
                           </div>
                       )}
                    </div>
                     <div className="bg-black border-t border-neutral-700 p-2">
                        <h3 className="text-white text-sm font-semibold mb-2 ml-2">Featured Products</h3>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {products.slice(0, 5).map(p => <LiveProductCard key={p.id} product={p} />)}
                        </div>
                    </div>
                </div>

                {/* Chat Section */}
                <div className="lg:col-span-1 h-full hidden lg:flex">
                   <LiveChat liveSessionId={playbackId} />
                </div>
            </div>
        </BuyerLayout>
    );
};

export default BuyerLiveStreamPage;
