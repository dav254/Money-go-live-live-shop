
'use client';

import { useState } from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { SellerShop } from '@/lib/types';
import { collection, query, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, Search, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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

const SellerCard = ({ seller }: { seller: SellerShop }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isApplied, setIsApplied] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleApply = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'You must be logged in to apply.' });
            return;
        }
        setIsSubmitting(true);
        const applicationRef = doc(collection(firestore, 'resellerApplications'));
        try {
            await setDoc(applicationRef, {
                id: applicationRef.id,
                resellerId: user.uid,
                sellerId: seller.id, // Correctly use seller.id which is the document ID of the sellerShop
                status: 'pending',
                applicationDate: serverTimestamp(),
            });
            toast({ title: 'Application Sent!', description: `Your request to resell for ${seller.shopName} has been sent.` });
            setIsApplied(true);
        } catch (error) {
            console.error('Error creating reseller application:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your application.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={seller.logoUrl} alt={seller.shopName} />
                    <AvatarFallback>{seller.shopName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <Link href={`/sellers/${seller.sellerId}`} className="hover:underline">
                        <p className="font-bold">{seller.shopName}</p>
                    </Link>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {seller.followers || 0} followers
                    </p>
                </div>
                <Button onClick={handleApply} disabled={isSubmitting || isApplied}>
                    {isApplied ? <CheckCircle className="mr-2 h-4 w-4" /> : null}
                    {isApplied ? 'Applied' : (isSubmitting ? 'Applying...' : 'Apply')}
                </Button>
            </CardContent>
        </Card>
    )
}


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
                            Browse all available seller shops on the platform. Click "Apply" to send a request to become their reseller.
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
                                    <SellerCard key={seller.id} seller={seller} />
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
