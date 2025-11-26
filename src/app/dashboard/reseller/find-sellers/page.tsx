
'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { SellerShop } from '@/lib/types';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SellerCardSkeleton = () => (
    <Card>
        <CardContent className="p-4 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-9 w-24" />
        </CardContent>
    </Card>
);


export default function FindSellersPage() {
    const firestore = useFirestore();

    const sellersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sellerShops'));
    }, [firestore]);

    const { data: sellers, isLoading } = useCollection<SellerShop>(sellersQuery);

    return (
        <ResellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center gap-2">
                            Find New Partners
                        </CardTitle>
                        <CardDescription>
                            Browse all available seller shops on the platform. Visit a shop to apply to become their reseller.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search for shops..." className="pl-9" />
                        </div>
                        <div className="space-y-4">
                            {isLoading ? (
                                <>
                                    <SellerCardSkeleton />
                                    <SellerCardSkeleton />
                                    <SellerCardSkeleton />
                                </>
                            ) : sellers && sellers.length > 0 ? (
                                sellers.map(seller => (
                                    <Card key={seller.id}>
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <Avatar className="h-12 w-12">
                                                <AvatarImage src={seller.logoUrl} alt={seller.shopName} />
                                                <AvatarFallback>{seller.shopName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="font-bold">{seller.shopName}</p>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {seller.followers || 0} followers
                                                </p>
                                            </div>
                                            <Button asChild>
                                                <Link href={`/sellers/${seller.sellerId}`}>Visit & Apply</Link>
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    No seller shops found.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ResellerLayout>
    );
}
