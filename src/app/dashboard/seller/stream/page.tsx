
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import Recorder from '@/components/studio/Recorder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio } from 'lucide-react';
import { LiveProductShelf } from '@/components/studio/LiveProductShelf';
import { useUser } from '@/firebase';
import { PinnedProduct } from '@/components/live/PinnedProduct';
import React from 'react';
import { LiveActivityFeed } from '@/components/studio/LiveActivityFeed';
import { StreamControls } from '@/components/studio/StreamControls';
import type { Product } from '@/lib/types';

export default function SellerStreamPage() {
    const { user } = useUser();
    const [isLive, setIsLive] = React.useState(false);
    const [isStarting, setIsStarting] = React.useState(false);
    const [pinnedProduct, setPinnedProduct] = React.useState<Product | null>(null);

    const handleGoLive = async () => {
        setIsStarting(true);
        // Simulate a delay for setting up the stream
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsLive(true);
        setIsStarting(false);
    };

    const handleEndLive = () => {
        setIsLive(false);
    };
    
    const handlePinProduct = (product: Product) => {
        setPinnedProduct(product);
    };

    const handleUnpinProduct = () => {
        setPinnedProduct(null);
    }

    return (
        <SellerLayout>
            <div className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-4rem)] overflow-hidden">
                {/* Main Content: Video Feed and Controls */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    <div className="flex-1 relative">
                        <Recorder isLive={isLive} />
                        {pinnedProduct && (
                            <div className="absolute bottom-4 left-4 z-20">
                                <PinnedProduct product={pinnedProduct} />
                            </div>
                        )}
                    </div>
                    <StreamControls isLive={isLive} isStarting={isStarting} onGoLive={handleGoLive} onEndLive={handleEndLive} />
                </div>

                {/* Right Sidebar: Products and Activity */}
                <div className="flex flex-col gap-4 overflow-hidden">
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle>My Products</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                             {user && <LiveProductShelf sellerId={user.uid} onPinProduct={handlePinProduct} onUnpinProduct={handleUnpinProduct} />}
                        </CardContent>
                    </Card>
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle>Live Activity</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-hidden">
                           <LiveActivityFeed liveSessionId={user?.uid || null} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </SellerLayout>
    );
}
