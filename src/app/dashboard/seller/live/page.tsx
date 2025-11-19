'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { SellerShop } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { CheckCircle, Award, Video, Rocket, ShoppingBag, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const UnlockRequirement = ({ title, userProgress, goal, icon: Icon }: { title: string, userProgress: number, goal: number, icon: React.ElementType }) => {
    const isComplete = userProgress >= goal;
    const progressPercentage = Math.min((userProgress / goal) * 100, 100);

    return (
        <div className="flex items-center gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isComplete ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <p className="font-semibold">{title}</p>
                    <p className={`text-sm font-bold ${isComplete ? 'text-green-500' : 'text-muted-foreground'}`}>{userProgress} / {goal}</p>
                </div>
                <Progress value={progressPercentage} className="h-2 mt-1" />
            </div>
        </div>
    )
}

export default function SellerLivePage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const sellerShopRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'sellerShops', user.uid);
    }, [firestore, user]);

    const { data: shopData, isLoading } = useDoc<SellerShop>(sellerShopRef);

    const isLivePartner = shopData?.isLivePartner === true;

    if (isLoading) {
        return (
            <SellerLayout>
                <div className="p-8">
                     <Skeleton className="h-10 w-1/2 mb-8" />
                     <Card>
                        <CardHeader>
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-4 w-full mt-2" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <Skeleton className="h-12 w-full" />
                             <Skeleton className="h-12 w-full" />
                             <Skeleton className="h-12 w-full" />
                        </CardContent>
                     </Card>
                </div>
            </SellerLayout>
        )
    }

    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Live Selling Studio
                </h1>

                {isLivePartner ? (
                    <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-primary">
                                <Award className="h-7 w-7"/>
                                You are a MoneyGo Live Partner!
                            </CardTitle>
                            <CardDescription>
                                You've unlocked all live selling features. Start a show to connect with buyers and boost your sales.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button size="lg" className="font-bold text-lg" asChild>
                                <Link href="/dashboard/seller/live/start">
                                    <Video className="mr-2 h-5 w-5" />
                                    Start a New Live Show
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-primary">
                                <Rocket className="h-6 w-6" />
                                Unlock Your Live Selling Superpowers
                            </CardTitle>
                            <CardDescription>
                                To ensure a high-quality experience for buyers, we ask sellers to complete a few steps before unlocking clickable products and other powerful live features.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <UnlockRequirement title="Complete Sales On-Platform" userProgress={3} goal={10} icon={ShoppingBag} />
                            <UnlockRequirement title="Maintain Seller Rating" userProgress={4.8} goal={4.5} icon={Star} />
                            <UnlockRequirement title="Gain Followers" userProgress={25} goal={50} icon={Users} />
                            <div className="pt-4">
                                <Button asChild>
                                    <Link href="/dashboard/seller/earnings">View My Shop Performance</Link>
                                </Button>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Once all requirements are met, your Live Partner status will be activated automatically.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                 <Card>
                    <CardHeader>
                        <CardTitle>Recent Live Streams</CardTitle>
                        <CardDescription>Review performance and see comments from your past shows.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                            <p className="text-muted-foreground">You have no past live streams.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
