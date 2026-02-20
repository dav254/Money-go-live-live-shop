'use client';

import React, { useState } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { GenerateDescriptionForm } from '@/components/dashboard/generate-description-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Film, Sparkles, ImageIcon, BadgeCent, RadioTower, Text, Loader2, Image as ImageGeneratorIcon, Mail } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUser, useUserProfile } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

const tools = [
  {
    title: 'AI Product Description',
    description: 'Generate compelling, SEO-friendly descriptions for your products.',
    icon: Sparkles,
    href: '/dashboard/seller/ai-tools#',
    cta: 'Use Generator',
    points: 25,
    isTab: true,
  },
  {
    title: 'AI Caption Generator',
    description: 'Generate viral captions for TikTok, Instagram, and Facebook to boost engagement.',
    icon: Sparkles,
    href: '/dashboard/seller/ai-tools/caption-generator',
    cta: 'Generate Caption',
    points: 50,
  },
  {
    title: 'AI Email Marketer',
    description: 'Generate professional marketing emails to send to your customers and boost loyalty.',
    icon: Mail,
    href: '/dashboard/seller/ai-tools/email-marketer',
    cta: 'Launch Marketer',
    points: 40,
  },
  {
    title: 'AI Image Generator',
    description: 'Create brand new images for your products from a simple text description.',
    icon: ImageGeneratorIcon,
    href: '/dashboard/seller/ai-tools/image-to-video',
    cta: 'Create Image',
    points: 100,
  },
   {
    title: 'Text-to-Video Generator',
    description: 'Create brand new video content from a simple text description.',
    icon: Text,
    href: '/dashboard/seller/ai-tools/text-to-video',
    cta: 'Create Video',
    points: 250,
  },
   {
    title: 'AI Video Enhancer',
    description: 'Animate a product image with a text prompt to create a short video.',
    icon: Film,
    href: '/dashboard/seller/ai-tools/video-enhancer',
    cta: 'Enhance Video',
    points: 250,
  },
];


const BuyPointsDialog = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoadingPayment, setIsLoadingPayment] = useState<string | null>(null);

    const pointPackages = [
        { points: 500, price: 5, description: 'Get started' },
        { points: 1200, price: 10, description: 'Best value' },
        { points: 3000, price: 25, description: 'Power user' },
    ];

    const handlePayment = async (gateway: 'paystack' | 'paypal', points: number, price: number) => {
        if (!user?.email) {
            toast({
                variant: 'destructive',
                title: 'Cannot initiate payment',
                description: 'User email is missing.',
            });
            return;
        }
        setIsLoadingPayment(gateway);

        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionType: 'points-purchase',
                    amount: price,
                    email: user.email,
                    gateway: gateway,
                    metadata: {
                        userId: user.uid,
                        points: points
                    }
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Failed to create payment intent.');
            }

            const data = await response.json();
            
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                throw new Error('No checkout URL received.');
            }

        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: 'Payment Error',
                description: err.message || 'Could not initiate payment. Please try again.',
            });
            setIsLoadingPayment(null);
        }
    };


    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Buy AI Points</DialogTitle>
                <DialogDescription>
                    Points are used to power your AI tools and Live Shows. Choose a package to top up your balance.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                {pointPackages.map(pkg => (
                    <Card key={pkg.points}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-lg">{pkg.points.toLocaleString()} Points</p>
                                <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-bold text-primary">${pkg.price}</p>
                                <div className="flex gap-2 mt-2">
                                    <Button size="sm" onClick={() => handlePayment('paystack', pkg.points, pkg.price)} disabled={!!isLoadingPayment}>
                                        {isLoadingPayment === 'paystack' ? <Loader2 className="animate-spin" /> : 'Paystack'}
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => handlePayment('paypal', pkg.points, pkg.price)} disabled={!!isLoadingPayment}>
                                         {isLoadingPayment === 'paypal' ? <Loader2 className="animate-spin" /> : 'PayPal'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </DialogContent>
    );
};


export default function SellerAIToolsPage() {
  const { user } = useUser();
  const { userProfile, isLoading } = useUserProfile(user?.uid);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
                 <h1 className="font-headline text-3xl font-bold tracking-tight">
                    AI Seller Toolkit
                </h1>
                <p className="text-muted-foreground">
                Use these AI-powered tools to create better content and sell more.
                </p>
            </div>
            <Dialog>
            <Card className="mt-4 md:mt-0">
                <CardContent className="p-3 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-md">
                        <BadgeCent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Your Balance</p>
                        {isLoading ? (
                            <Skeleton className="h-6 w-24" />
                        ) : (
                            <p className="text-xl font-bold">{(userProfile?.aiPoints || 0).toLocaleString()} Points</p>
                        )}
                    </div>
                     <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Buy Points</Button>
                    </DialogTrigger>
                </CardContent>
            </Card>
            <BuyPointsDialog />
            </Dialog>
        </div>
       

        <Tabs defaultValue="description-generator" className="space-y-4">
            <TabsList>
                <TabsTrigger value="description-generator">Product Description</TabsTrigger>
                <TabsTrigger value="content-creation">Content & Strategy</TabsTrigger>
            </TabsList>
            
            <TabsContent value="description-generator">
                <GenerateDescriptionForm />
            </TabsContent>

            <TabsContent value="content-creation">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tools.filter(t => !t.isTab).map((tool) => (
                        <Card key={tool.title} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-3">
                                        <tool.icon className="h-6 w-6 text-primary" />
                                        <span>{tool.title}</span>
                                    </span>
                                </CardTitle>
                                <CardDescription>{tool.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow flex flex-col justify-end gap-2">
                                <div className="text-center font-bold text-lg my-2">
                                    {tool.points} Points
                                </div>
                                 <Button className="w-full" asChild>
                                    <Link href={tool.href} className="flex items-center">
                                        {tool.cta}
                                    </Link>
                                 </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
