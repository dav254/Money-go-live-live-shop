
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video } from 'lucide-react';

export default function SellerLivePage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    My Media
                </h1>

                 <Card>
                    <CardHeader>
                        <CardTitle>My Videos & Images</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <Video className="h-10 w-10 text-muted-foreground" />
                                <p className="text-muted-foreground">Your uploaded product videos and images will appear here.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
