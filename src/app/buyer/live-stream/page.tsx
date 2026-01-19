
'use client';

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card } from '@/components/ui/card';
import { Users } from 'lucide-react';

const socket = io('https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev');

export default function BuyerLiveListPage() {
    const [sellers, setSellers] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        socket.emit('get-sellers');
        
        socket.on('sellers-update', (updatedSellers) => {
            setSellers(updatedSellers);
        });

        return () => {
            socket.off('sellers-update');
        };
    }, []);

    const refreshSellers = () => {
        socket.emit('get-sellers');
    };
    
    const startWatching = (seller: any) => {
        router.push(`/buyer/live/${seller.streamId}`);
    };

    return (
        <BuyerLayout>
            <div className="container mx-auto p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">👁️ Watch Live</h2>
                    <Button variant="outline" onClick={refreshSellers}>🔄 Refresh</Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sellers.length === 0 ? (
                        <p className="col-span-full text-center text-muted-foreground p-12">No sellers are live right now.</p>
                    ) : (
                        sellers.map(seller => (
                            <Card key={seller.streamId} className="overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/50" onClick={() => startWatching(seller)}>
                                <div className="bg-gradient-to-br from-blue-500 to-purple-600 h-40 flex items-center justify-center text-5xl relative">
                                    🎬
                                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">🔴 LIVE</div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold">{seller.sellerName}</h3>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> {seller.buyers || 0} watching</p>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </BuyerLayout>
    );
}
