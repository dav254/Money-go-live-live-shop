
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { GenerateDescriptionForm } from '@/components/dashboard/generate-description-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Film, Sparkles, ExternalLink, Handshake, ImageIcon, BadgeCent, ShoppingCart, RadioTower, Text } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const tools = [
  {
    title: "AI Product Description",
    description: "Generate compelling, SEO-friendly descriptions for your products.",
    icon: Sparkles,
    href: "/dashboard/seller/ai-tools#",
    cta: "Use Generator",
    points: 25,
    isTab: true,
  },
  {
    title: "AI Live Selling Co-Pilot",
    description: "Get real-time suggestions and analysis of buyer comments during your live stream.",
    icon: RadioTower,
    href: "/dashboard/seller/ai-tools/live-copilot",
    cta: "Launch Co-Pilot",
    points: 500,
  },
  {
    title: "AI Deal Maker",
    description: "Generate strategic deal suggestions like bundles and flash sales to boost revenue.",
    icon: Handshake,
    href: "/dashboard/seller/ai-tools/deal-maker",
    cta: "Launch Deal Maker",
    points: 100,
  },
  {
    title: "Image-to-Video Generator",
    description: "Turn your static product images into engaging short videos for your feed.",
    icon: ImageIcon,
    href: "/dashboard/seller/ai-tools/image-to-video",
    cta: "Create Video",
    points: 200,
  },
  {
    title: "Text-to-Video Generator",
    description: "Create brand new video content from a simple text description.",
    icon: Text,
    href: "/dashboard/seller/ai-tools/text-to-video",
    cta: "Create Video",
    points: 250,
  },
  {
    title: "AI Caption Generator",
    description: "Generate viral captions for TikTok, Instagram, and Facebook to boost engagement.",
    icon: Bot,
    href: "/dashboard/seller/ai-tools/caption-generator",
    cta: "Generate Caption",
    points: 50,
  },
];


export default function SellerAIToolsPage() {
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
            <Card className="mt-4 md:mt-0">
                <CardContent className="p-3 flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-md">
                        <BadgeCent className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Your Balance</p>
                        <p className="text-xl font-bold">1,000 Points</p>
                    </div>
                     <Button size="sm" variant="outline">Get More</Button>
                </CardContent>
            </Card>
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
                                <CardTitle className="flex items-center gap-3">
                                    <tool.icon className="h-6 w-6 text-primary" />
                                    <span>{tool.title}</span>
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
