'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card } from '@/components/ui/card';
import { Users, RefreshCw, ExternalLink, Clock, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
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
    }, []);

    // Handle stream ended
    const handleStreamEnded = useCallback((data: { streamId: string }) => {
        toast({
            title: 'Stream Ended',
            description: `A stream has ended.`,
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
            toast({
                title: 'Connected',
                description: 'Ready to view live streams',
                duration: 3000
            });
        };

        const onDisconnect = () => {
            console.log('❌ Disconnected from socket server');
            setConnectionStatus('disconnected');
            toast({
                title: 'Disconnected',
                description: 'Trying to reconnect...',
                variant: 'destructive'
            });
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

        // Request initial sellers list
        socket.emit('get-sellers');

        // Auto-refresh every 10 seconds
        const refreshInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('get-sellers');
            }
        }, 10000);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('sellers-update', handleSellersUpdate);
            socket.off('seller-offline', handleStreamEnded);
            clearInterval(refreshInterval);
        };
    }, [handleSellersUpdate, handleStreamEnded, toast]);

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
        if (diffMins === 1) return '1 min ago';
        if (diffMins < 60) return `${diffMins} mins ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return '1 hour ago';
        if (diffHours < 24) return `${diffHours} hours ago`;
        
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return '1 day ago';
        return `${diffDays} days ago`;
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
                            } className="flex items-center gap-2">
                                {connectionStatus === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {connectionStatus === 'connected' ? 'Connected' :
                                 connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
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
                            disabled={loading || connectionStatus !== 'connected'}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Connection Status Alert */}
                {connectionStatus !== 'connected' && (
                    <div className={`mb-6 p-4 rounded-lg ${
                        connectionStatus === 'connecting' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                        'bg-red-50 border-red-200 text-red-800'
                    } border`}>
                        <p className="font-medium flex items-center gap-2">
                            {connectionStatus === 'connecting' ? '🟡' : '🔴'}
                            {connectionStatus === 'connecting' ? 'Connecting to server...' : 'Disconnected from server'}
                        </p>
                        <p className="text-sm mt-1">
                            {connectionStatus === 'connecting' 
                                ? 'Please wait while we connect to the streaming server.'
                                : 'Try refreshing the page or check your internet connection.'}
                        </p>
                    </div>
                )}

                {/* Streams Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((i) => (
                            <Card key={i} className="overflow-hidden">
                                <Skeleton className="h-48 w-full" />
                                <div className="p-5 space-y-3">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : sellers.length === 0 ? (
                    <div className="text-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-2xl">
                        <div className="text-6xl mb-4">🎬</div>
                        <h3 className="text-2xl font-semibold mb-3">No Live Streams Available</h3>
                        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                            There are no sellers currently streaming. Check back later or ask sellers to go live.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button onClick={refreshSellers} variant="outline" size="lg">
                                <RefreshCw className="mr-2 h-5 w-5" />
                                Check Again
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {sellers.map((seller) => (
                            <Card 
                                key={seller.streamId} 
                                className="overflow-hidden cursor-pointer hover:shadow-xl hover:border-primary/50 transition-all duration-300 group border-2"
                                onClick={() => startWatching(seller)}
                            >
                                {/* Stream Thumbnail */}
                                <div className="relative bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 h-48 flex items-center justify-center">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="text-6xl z-10">🎬</div>
                                    
                                    {/* Live Badge */}
                                    <div className="absolute top-3 right-3 z-20">
                                        <div className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                                            <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                                            LIVE
                                        </div>
                                    </div>

                                    {/* Viewers Count */}
                                    <div className="absolute bottom-3 left-3 z-20 bg-black/80 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-2">
                                        <Users className="h-3.5 w-3.5" />
                                        {seller.buyers || 0} watching
                                    </div>
                                    
                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <div className="bg-white text-black px-6 py-2 rounded-full font-semibold transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                            Watch Now
                                        </div>
                                    </div>
                                </div>

                                {/* Stream Info */}
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg truncate pr-2">
                                            {seller.sellerName}
                                        </h3>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => copyStreamLink(seller, e)}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5" />
                                                {seller.createdAt ? formatTimeAgo(seller.createdAt) : 'Just now'}
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                ID: {seller.streamId.substring(0, 6)}...
                                            </Badge>
                                        </div>
                                        
                                        <div className="pt-2">
                                            <Button 
                                                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                                size="sm"
                                            >
                                                Join Stream
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Info Footer */}
                <div className="mt-12 pt-8 border-t text-center">
                    <p className="text-sm text-muted-foreground">
                        🔄 Streams update automatically every 10 seconds
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Click any stream card to start watching
                    </p>
                </div>
            </div>
        </BuyerLayout>
    );
}
