
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { GenerateDescriptionForm } from '@/components/dashboard/generate-description-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Film, Sparkles, ExternalLink, Handshake, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const tools = [
  {
    title: "AI Deal Maker",
    description: "Generate strategic deal suggestions like bundles, flash sales, and tiered offers for your products.",
    icon: Handshake,
    href: "/dashboard/seller/ai-tools/deal-maker",
    cta: "Launch Deal Maker",
    isPremium: false,
  },
  {
    title: "Image-to-Video Generator",
    description: "Turn your static product images into engaging short videos for your feed.",
    icon: ImageIcon,
    href: "/dashboard/seller/ai-tools/image-to-video",
    cta: "Create Video",
    isPremium: false, // Mark as enabled
  },
  {
    title: "AI Caption Generator",
    description: "Generate viral captions for TikTok, Instagram, and Facebook to boost engagement.",
    icon: Sparkles,
    href: "#",
    cta: "Generate Caption",
    isPremium: true,
  },
  {
    title: "AI Poster Maker",
    description: "Create stunning promotional posters for your products in seconds.",
    icon: Bot,
    href: "#",
    cta: "Launch Maker",
    isPremium: true,
  },
  {
    title: "AI Video Enhancer",
    description: "Add music, text, and effects to make your product videos pop.",
    icon: Film,
    href: "#",
    cta: "Enhance Video",
    isPremium: true,
  },
];


export default function SellerAIToolsPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          AI Seller Toolkit
        </h1>
        <p className="text-muted-foreground">
          Use these AI-powered tools to create better content, write compelling descriptions, and sell more.
        </p>

        <Tabs defaultValue="description-generator" className="space-y-4">
            <TabsList>
                <TabsTrigger value="description-generator">Product Description Generator</TabsTrigger>
                <TabsTrigger value="content-creation">Content & Strategy Tools</TabsTrigger>
            </TabsList>
            
            <TabsContent value="description-generator">
                <GenerateDescriptionForm />
            </TabsContent>

            <TabsContent value="content-creation">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tools.map((tool) => (
                        <Card key={tool.title} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <tool.icon className="h-6 w-6 text-primary" />
                                    <span>{tool.title}</span>
                                </CardTitle>
                                <CardDescription>{tool.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow flex items-end">
                                <Button className="w-full" disabled={tool.isPremium} asChild>
                                    <Link href={tool.href} className="flex items-center">
                                        {tool.cta}
                                        {!tool.isPremium && <ExternalLink className="ml-2 h-4 w-4" />}
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
