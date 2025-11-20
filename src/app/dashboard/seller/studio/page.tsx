
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Video } from 'lucide-react';
import Link from 'next/link';

export default function SellerStudioPage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Live Selling Studio
                </h1>

                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-primary">
                            <Award className="h-7 w-7"/>
                            You are a Go Earn Live Partner!
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
