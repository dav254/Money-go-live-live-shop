'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileVideo, Upload, PlusCircle, Video } from 'lucide-react';
import Link from 'next/link';

const studioFeatures = [
    {
        title: "Record New Video",
        description: "Use our guided 'Story Mode' to create a perfect product video step-by-step.",
        href: "/seller/studio/record",
        icon: Video,
        cta: "Start Recording",
    },
    {
        title: "Upload Existing Video",
        description: "Have a video already? Upload it directly and add your product details.",
        href: "#",
        icon: Upload,
        cta: "Upload Video",
    },
     {
        title: "My Recordings",
        description: "View, manage, and see analytics for all your published product videos.",
        href: "/dashboard/seller/studio/recordings",
        icon: FileVideo,
        cta: "View Recordings",
    },
];

export default function SellerStudioPage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Seller Studio
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Create professional, shoppable videos that sell. Forget live streaming headaches.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {studioFeatures.map(feature => (
                        <Card key={feature.title} className="flex flex-col">
                             <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <feature.icon className="h-6 w-6 text-primary" />
                                    <span>{feature.title}</span>
                                </CardTitle>
                                <CardDescription>{feature.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow flex items-end">
                                <Button className="w-full" asChild>
                                    <Link href={feature.href}>{feature.cta}</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </SellerLayout>
    );
}
