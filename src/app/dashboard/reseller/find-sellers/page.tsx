
'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { SellerShop, ResellerApplication } from '@/lib/types';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Loader2 } from 'lucide-react';
import React from 'react';

const SellerCard = ({ shop }: { shop: SellerShop }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [applicationStatus, setApplicationStatus] = React.useState<'idle' | 'pending' | 'applied' | 'approved'>('idle');
    const [isApplying, setIsApplying] = React.useState(false);

    // Check existing application status
    React.useEffect(() => {
        if (!user || !firestore) return;
        
        const checkStatus = async () => {
            const appsRef = collection(firestore, 'resellerApplications');
            const q = query(appsRef, where('resellerId', '==', user.uid), where('sellerId', '==', shop.sellerId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const appData = querySnapshot.docs[0].data() as ResellerApplication;
                setApplicationStatus(appData.status);
            }
        };
        checkStatus();
    }, [user, firestore, shop.sellerId]);


    const handleApply = async () => {
        if (!user || !firestore) return;
        setIsApplying(true);
        const appRef = doc(collection(firestore, 'resellerApplications'));
        try {
            await setDoc(appRef, {
                id: appRef.id,
                resellerId: user.uid,
                sellerId: shop.sellerId,
                status: 'pending',
                applicationDate: serverTimestamp(),
            });
            toast({ title: 'Application Sent!', description: `Request sent to ${shop.shopName}.` });
            setApplicationStatus('pending');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not send application.' });
        } finally {
            setIsApplying(false);
        }
    };

    const getButtonState = () => {
        switch (applicationStatus) {
            case 'pending':
                return <Button variant="secondary" disabled>Pending Approval</Button>;
            case 'approved':
                return <Button variant="secondary" disabled>Approved</Button>;
            case 'applied': // This case is now handled by 'pending'
                return <Button variant="secondary" disabled>Applied</Button>;
            default:
                return (
                    <Button onClick={handleApply} disabled={isApplying}>
                        {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Apply to Resell
                    </Button>
                );
        }
    }

    return (
        <Card className="overflow-hidden">
            <CardHeader className="p-0">
                <Link href={`/sellers/${shop.sellerId}`}>
                    <div className="relative aspect-video bg-muted">
                        {shop.bannerUrl && <Image src={shop.bannerUrl} alt={`${shop.shopName} banner`} fill className="object-cover" />}
                    </div>
                </Link>
            </CardHeader>
            <CardContent className="p-4">
                 <div className="flex items-center gap-3 -mt-12">
                    <Avatar className="h-16 w-16 border-4 border-background">
                        <AvatarImage src={shop.logoUrl} alt={shop.shopName} />
                        <AvatarFallback>{shop.shopName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="pt-8">
                        <h3 className="font-bold text-lg">{shop.shopName}</h3>
                        <p className="text-xs text-muted-foreground">{shop.followers || 0} Followers</p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 h-10 overflow-hidden">{shop.description}</p>
            </CardContent>
            <CardFooter className="flex justify-end">
                {getButtonState()}
            </CardFooter>
        </Card>
    );
};

export default function FindSellersPage() {
    const firestore = useFirestore();
    const shopsQuery = useMemoFirebase(() => query(collection(firestore, 'sellerShops')), [firestore]);
    const { data: shops, isLoading } = useCollection<SellerShop>(shopsQuery);

    return (
        <ResellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl">Find Sellers</CardTitle>
                        <CardDescription>Browse shops and apply to become a reseller. Approved sellers will allow you to share their products for a commission.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="relative mb-6 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search for a shop..." className="pl-9" />
                        </div>
                        {isLoading ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <Skeleton className="h-80 w-full" />
                                <Skeleton className="h-80 w-full" />
                                <Skeleton className="h-80 w-full" />
                             </div>
                        ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {shops?.map(shop => <SellerCard key={shop.id} shop={shop} />)}
                            </div>
                        )}
                         {!isLoading && shops?.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">No shops found.</div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ResellerLayout>
    );
}
