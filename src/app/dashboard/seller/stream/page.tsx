'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio } from 'lucide-react';

export default function SellerStreamPage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Live Stream Studio
                </h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Start Your Live Show</CardTitle>
                        <CardDescription>
                            Get ready to connect with your audience and sell your products in real-time.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center gap-4 h-96 border-2 border-dashed rounded-lg">
                        <div className="p-4 bg-primary/10 rounded-full">
                            <Radio className="h-10 w-10 text-primary" />
                        </div>
                        <p className="max-w-xs text-muted-foreground">
                            Your camera and microphone controls will appear here. When you're ready, click the button below to start your broadcast.
                        </p>
                        <Button size="lg" className="font-bold">
                            Go Live
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
