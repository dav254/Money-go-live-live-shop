
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card } from '@/components/ui/card';
import { Users, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const socket = io('https://5000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev', {
  transports: ['websocket', 'polling']
});

export default function BuyerLiveListPage() {
    const [sellers, setSellers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const router = useRouter();
    const { toast } = useToast();

    // Handle sellers update
    const handleSellersUpdate = useCallback((updatedSellers: any[]) => {
        console.log('📡 Received sellers update:', updatedSellers);
        setSellers(updatedSellers);
        setLoading(false);
        
        if (updatedSellers.length > 0) {
            toast({
                title: `Found ${updatedSellers.length} live stream${updatedSellers.length > 1 ? 's' : ''}`,
                duration: 3000,
            });
        }
    }, [toast]);

    // Handle stream ended
    const handleStreamEnded = useCallback((data: { streamId: string }) => {
        toast({
            title: 'Stream Ended',
            description: `Stream ${data.streamId} has ended`,
            variant: 'destructive'
        });
        
        setSellers(prev => prev.filter(seller => seller.streamId !== data.streamId));
    }, [toast]);

    // Handle socket connection events
    useEffect(() => {
        const onConnect = () => {
            console.log('✅ Connected to socket server');
            setConnectionStatus('connected');
            socket.emit('get-sellers');
        };

        const onDisconnect = () => {
            console.log('❌ Disconnected from socket server');
            setConnectionStatus('disconnected');
        };

        const onConnectError = (error: any) => {
            console.error('Socket connection error:', error);
            setConnectionStatus('error');
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('sellers-update', handleSellersUpdate);
        socket.on('seller-offline', handleStreamEnded);

        // Auto-refresh every 30 seconds
        const refreshInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('get-sellers');
            }
        }, 30000);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('sellers-update', handleSellersUpdate);
            socket.off('seller-offline', handleStreamEnded);
            clearInterval(refreshInterval);
        };
    }, [handleSellersUpdate, handleStreamEnded]);

    const refreshSellers = () => {
        setLoading(true);
        socket.emit('get-sellers');
        toast({
            title: 'Refreshing live streams...',
        });
    };
    
    const startWatching = (seller: any) => {
        console.log('Navigating to stream:', seller.streamId);
        router.push(`/buyer/live/${seller.streamId}`);
    };

    const copyStreamLink = (seller: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const streamUrl = `${window.location.origin}/buyer/live/${seller.streamId}`;
        navigator.clipboard.writeText(streamUrl);
        toast({
            title: 'Link copied!',
            description: 'Stream link copied to clipboard',
        });
    };

    const formatTimeAgo = (timestamp: string) => {
        if (!timestamp) return 'Just now';
        const now = new Date();
        const streamTime = new Date(timestamp);
        const diffMs = now.getTime() - streamTime.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins === 1) return '1 minute ago';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return '1 hour ago';
        if (diffHours < 24) return `${diffHours} hours ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    return (
        <BuyerLayout>
            <div className="container mx-auto p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">🎥 Live Streams</h1>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <Badge variant={
                                connectionStatus === 'connected' ? 'default' :
                                connectionStatus === 'connecting' ? 'secondary' : 'destructive'
                            }>
                                {connectionStatus === 'connected' ? '🟢 Connected' :
                                 connectionStatus === 'connecting' ? '🟡 Connecting...' : '🔴 Disconnected'}
                            </Badge>
                            <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {sellers.length} live stream{sellers.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            onClick={refreshSellers}
                            disabled={loading}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Connection Status Alert */}
                {connectionStatus === 'disconnected' && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 font-medium">⚠️ Disconnected from server</p>
                        <p className="text-red-600 text-sm">Try refreshing the page or check your internet connection.</p>
                    </div>
                )}

                {/* Streams Grid */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <RefreshCw className="h-12 w-12 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground">Loading live streams...</p>
                    </div>
                ) : sellers.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🎬</div>
                        <h3 className="text-xl font-semibold mb-2">No Live Streams Available</h3>
                        <p className="text-muted-foreground mb-6">
                            Check back later or ask sellers to go live.
                        </p>
                        <Button onClick={refreshSellers} variant="outline">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Check Again
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {sellers.map((seller) => (
                            <Card 
                                key={seller.streamId} 
                                className="overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-300 group"
                                onClick={() => startWatching(seller)}
                            >
                                {/* Stream Thumbnail */}
                                <div className="relative bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 h-48 flex items-center justify-center text-6xl">
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                                    🎬
                                    
                                    {/* Live Badge */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1">
                                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                                            LIVE
                                        </span>
                                    </div>

                                    {/* Viewers Count */}
                                    <div className="absolute bottom-3 left-3 bg-black/70 text-white text-sm px-3 py-1 rounded-full flex items-center gap-2">
                                        <Users className="h-3 w-3" />
                                        {seller.buyers || 0} watching
                                    </div>
                                </div>

                                {/* Stream Info */}
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg truncate pr-2">
                                            {seller.sellerName}
                                        </h3>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                            onClick={(e) => copyStreamLink(seller, e)}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                {seller.createdAt ? formatTimeAgo(seller.createdAt) : 'Just now'}
                                            </div>
                                            <Badge variant="secondary" className="text-xs">
                                                ID: {seller.streamId.substring(0, 8)}...
                                            </Badge>
                                        </div>
                                        
                                        <div className="pt-3">
                                            <Button 
                                                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                                size="sm"
                                            >
                                                Watch Now
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Footer Info */}
                <div className="mt-12 pt-8 border-t text-center">
                    <p className="text-sm text-muted-foreground">
                        🔄 Streams update automatically every 30 seconds
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Click on any stream card to start watching
                    </p>
                </div>
            </div>
        </BuyerLayout>
    );
}
