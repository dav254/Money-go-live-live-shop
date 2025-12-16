'use client';

import React from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioTower, Video } from 'lucide-react';

export default function SellerLivePage() {

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Stream Studio</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Start a New Live Stream</CardTitle>
                        <CardDescription>This is where you will control and manage your live shopping events.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center mb-4">
                            <Video className="h-16 w-16 text-muted-foreground" />
                        </div>
                        <Button variant="destructive" className="w-full">
                            <RadioTower className="mr-2 h-4 w-4" />
                            Go Live (Feature Coming Soon)
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
};
