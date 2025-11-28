
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Sparkles, ShieldCheck, ShoppingCart, Text, Video, TrendingUp, Bot, Handshake, ImageIcon, RadioTower } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import React from 'react';

const capabilities = [
    {
        title: 'Content Generation',
        icon: Sparkles,
        description: 'I create compelling product descriptions, viral social media captions, and other marketing copy to help your sellers succeed.',
        href: '/dashboard/seller/ai-tools/caption-generator',
    },
    {
        title: 'Sales Strategy',
        icon: Handshake,
        description: 'I can analyze a product and suggest strategic deals, like flash sales and bundles, to help increase revenue for your sellers.',
        href: '/dashboard/seller/ai-tools/deal-maker',
    },
     {
        title: 'Media Creation',
        icon: ImageIcon,
        description: 'Using text prompts or existing images, I can generate new promotional videos for products to make them more engaging.',
        href: '/dashboard/seller/ai-tools/image-to-video',
    },
    {
        title: 'Live Selling Co-Pilot',
        icon: RadioTower,
        description: 'During live streams, I analyze viewer comments in real-time to provide sellers with strategic advice and suggested actions.',
        href: '/dashboard/seller/ai-tools/live-copilot',
    },
    {
        title: 'Recommendation Engine',
        icon: TrendingUp,
        description: 'I analyze user behavior and product data to power the "Recommended for You" and other discovery features on the platform.',
        href: '/dashboard/admin/ai/recommendations',
    },
     {
        title: 'Fraud & Content Moderation',
        icon: ShieldCheck,
        description: 'I monitor transactions for fraudulent patterns and review user-generated content to flag potential policy violations for your review.',
        href: '/dashboard/admin/ai/content-moderation',
    },
];


export default function AboutGoAIPage() {

    return (
        <AdminLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-primary/20">
                                <Bot className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="font-headline text-3xl">Hello, I'm Go-AI</CardTitle>
                                <CardDescription className="text-lg">Your built-in partner for managing and growing the Go Earn platform.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p>
                           I am an integrated AI assistant designed to automate tasks, provide insights, and enhance the experience for you, your sellers, and your buyers. My goal is to make the platform smarter, safer, and more successful. Below are some of my core capabilities.
                        </p>
                    </CardContent>
                </Card>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {capabilities.map(cap => (
                         <Card key={cap.title} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <cap.icon className="h-6 w-6 text-primary" />
                                    <span>{cap.title}</span>
                                </CardTitle>
                                <CardDescription>{cap.description}</CardDescription>
                            </CardHeader>
                             <CardContent className="flex-grow flex items-end">
                                <a href={cap.href} className="text-sm font-medium text-primary hover:underline">
                                    See it in action &rarr;
                                </a>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>My Learning Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Badge className="bg-green-600/80">Active & Learning</Badge>
                             <p className="text-muted-foreground">I am constantly learning from new sales data, user interactions, and product trends to improve my performance.</p>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </AdminLayout>
    );
}

    