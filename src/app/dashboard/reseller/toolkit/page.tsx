
'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Sparkles, Film, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const tools = [
  {
    title: "AI Poster & Video Maker",
    description: "Create stunning promotional posters and videos for your products in seconds.",
    icon: Bot,
    href: "/dashboard/seller/ai-tools/image-to-video",
    cta: "Launch Maker",
  },
  {
    title: "AI Caption Generator",
    description: "Generate viral captions for TikTok, Instagram, and Facebook to boost engagement.",
    icon: Sparkles,
    href: "/dashboard/reseller/ai-tools/caption-generator",
    cta: "Generate Caption",
  },
    {
    title: "AI Video Enhancer",
    description: "Add music, text, and effects to make your product videos pop.",
    icon: Film,
    href: "/dashboard/seller/ai-tools/text-to-video",
    cta: "Enhance Video",
  },
];

export default function ResellerToolkitPage() {
  return (
    <ResellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                Reseller Toolkit
            </h1>
            <p className="text-muted-foreground">Your AI-powered tools for maximizing sales. Currently free for all resellers.</p>
        </div>
        
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
                         <Button className="w-full" asChild>
                            <Link href={tool.href} className="flex items-center">
                                {tool.cta}
                                <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                         </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
      </div>
    </ResellerLayout>
  );
}
