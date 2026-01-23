'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileVideo, Upload, PlusCircle, Video, Bot, Text, Image as ImageIcon } from 'lucide-react';
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
];

const aiTools = [
     {
        title: "Text-to-Video Generator",
        description: "Create a brand new video from a simple text description.",
        href: "/dashboard/seller/ai-tools/text-to-video",
        icon: Text,
        cta: "Create with Text",
    },
    {
        title: "Animate Product Image",
        description: "Bring your static product images to life with AI-powered animation.",
        href: "/dashboard/seller/ai-tools/video-enhancer",
        icon: ImageIcon,
        cta: "Animate Image",
    }
]

export default function SellerStudioPage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Seller Studio
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Create professional, shoppable videos that sell.
                    </p>
                </div>

                <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Video className="h-6 w-6 text-primary" />
                            <span>Manual Creation</span>
                        </CardTitle>
                        <CardDescription>Record or upload your own video content.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6">
                        {studioFeatures.map(feature => (
                            <Card key={feature.title} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-xl">
                                        <feature.icon className="h-5 w-5" />
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
                    </CardContent>
                </Card>

                 <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Bot className="h-6 w-6 text-primary" />
                            <span>AI Video Creation</span>
                        </CardTitle>
                        <CardDescription>Use AI to generate stunning video content for your products automatically.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-6">
                        {aiTools.map(tool => (
                            <Card key={tool.title} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3 text-xl">
                                        <tool.icon className="h-5 w-5" />
                                        <span>{tool.title}</span>
                                    </CardTitle>
                                    <CardDescription>{tool.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow flex items-end">
                                    <Button className="w-full" asChild>
                                        <Link href={tool.href}>{tool.cta}</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
