
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Radio, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface LiveNowProps {
    isLive: boolean;
    isLoading: boolean;
    stream?: {
        thumbnailUrl: string;
        sellerName: string;
        viewers: number;
        products: number;
    };
}

export const LiveNow = ({ isLive, isLoading, stream }: LiveNowProps) => {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Live Now
                </CardTitle>
                {isLive && <Badge variant="destructive" className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>1 LIVE</Badge>}
            </CardHeader>
            <CardContent>
                {isLive && stream ? (
                    <div className="space-y-4">
                        <div className="rounded-lg overflow-hidden border">
                            <Image
                                src={stream.thumbnailUrl}
                                alt="Live stream thumbnail"
                                width={400}
                                height={225}
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <p className="font-semibold">Seller: {stream.sellerName}</p>
                            <p className="text-sm text-muted-foreground">{stream.viewers} viewers</p>
                             <p className="text-sm text-muted-foreground">{stream.products} products</p>
                        </div>
                        <Button asChild variant="outline" className="w-full">
                            <Link href="#">WATCH / MANAGE <ArrowRight className="h-4 w-4 ml-2" /></Link>
                        </Button>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground space-y-4 py-8">
                        <p>No sellers are currently live.</p>
                        <Button asChild variant="default">
                           <Link href="#">OPEN LIVE STUDIO <ArrowRight className="h-4 w-4 ml-2" /></Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
