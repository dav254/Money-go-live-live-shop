
'use client';

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BuyerLayout } from '@/components/layout/buyer-layout';

const socket = io('http://localhost:5000');

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
                <h2 className="text-2xl font-bold mb-4">👁️ Buyer - Watch Live</h2>
                
                <Button className="w-full mb-4" onClick={refreshSellers}>🔄 Refresh Live Sellers</Button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sellers.length === 0 ? (
                        <p className="col-span-full text-center text-muted-foreground">No live sellers right now</p>
                    ) : (
                        sellers.map(seller => (
                            <div key={seller.streamId} className="border rounded-lg overflow-hidden cursor-pointer hover:shadow-lg" onClick={() => startWatching(seller)}>
                                <div className="bg-gradient-to-br from-blue-500 to-purple-600 h-40 flex items-center justify-center text-5xl relative">
                                    🎬
                                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">🔴 LIVE</div>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-bold">{seller.sellerName}</h3>
                                    <p className="text-sm text-muted-foreground">👁️ {seller.buyers || 0} watching</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </BuyerLayout>
    );
}
