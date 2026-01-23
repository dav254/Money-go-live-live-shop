
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Youtube, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SellerGoLivePage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Go Live
                </h1>
                <Card className="mx-auto max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Youtube className="text-red-500"/> Go Live with YouTube</CardTitle>
                        <CardDescription>
                            Use the power of YouTube to stream to your audience on Go Earn.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                       <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-lg">Step 1: Start Your Stream on YouTube</h3>
                                <p className="text-sm text-muted-foreground">
                                    Use your phone or computer to start a live stream directly from your YouTube account. Once you're live, copy the share link.
                                </p>
                                <Button asChild variant="secondary" className="mt-2">
                                    <a href="https://www.youtube.com/live_dashboard" target="_blank" rel="noopener noreferrer">
                                       <ExternalLink className="mr-2 h-4 w-4" /> Open YouTube Studio
                                    </a>
                                </Button>
                            </div>
                             <div>
                                <h3 className="font-semibold text-lg">Step 2: Go Live on Go Earn</h3>
                                <p className="text-sm text-muted-foreground">
                                   After starting your stream on YouTube, head to your Control Room to paste the link and manage your pinned products.
                                </p>
                                <Button asChild className="mt-2">
                                    <Link href="/dashboard/seller/stream">
                                       <Video className="mr-2 h-4 w-4" /> Go to Control Room
                                    </Link>
                                </Button>
                            </div>
                       </div>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
