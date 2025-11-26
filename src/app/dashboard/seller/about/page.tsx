
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShoppingBag, Video, Users, MessageSquare, Package, BarChart, Rocket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const sellerBenefits = [
    { icon: ShoppingBag, title: "Upload & Sell Instantly", description: "Add videos, images & descriptions. Show real value—buyers love authenticity." },
    { icon: Video, title: "Go Live & Earn More", description: "Engage in real-time selling with live chat and Q&A to boost your sales." },
    { icon: Users, title: "Build Your Sales Army", description: "Let resellers promote your items. You only pay a commission when they make a sale." },
    { icon: MessageSquare, title: "Chat Directly With Buyers", description: "Receive messages instantly, answer questions fast, and build trust to increase conversions." },
    { icon: Package, title: "Simple Order Management", description: "Track new orders, update shipping status, and handle returns all in one place." },
    { icon: BarChart, title: "Dashboard Insights", description: "Access sales analytics, view top products, and understand buyer behavior." },
];

const growthHighlights = [
    "0% listing fees",
    "Unlimited product uploads",
    "TikTok-like product exposure",
    "Built-in Reseller Program",
    "Real-time sales analytics",
    "Secure & fast payouts",
];

const roadmapSteps = [
    { step: 1, title: "Complete Your Shop Profile", description: "Add a banner, logo, and description to build your brand." },
    { step: 2, title: "Upload Your First Product", description: "Video uploads are highly recommended to increase trust and sales." },
    { step: 3, title: "Set Stock & Price", description: "Use our simple form with auto-calculated fees." },
    { step: 4, title: "Enable the Reseller Program", description: "Set a commission rate to let others promote your items and expand your reach." },
    { step: 5, title: "Go Live to Boost Sales", description: "Schedule and start a live show to reach more people instantly." },
    { step: 6, title: "Share Your Shop Link", description: "Use your unique shop link to drive external traffic and build your brand." },
];

export default function SellerAboutPage() {
    const sellerName = "Seller"; // Placeholder, will be dynamic later

    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                
                <div className="text-center space-y-2 py-8">
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight">
                        Become a Go Earn Founding Seller
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        This is your exclusive opportunity to join Go Earn from the ground up, grow your brand, and shape the future of social commerce in Africa.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sellerBenefits.map((item, index) => (
                        <Card key={index} className="bg-card/50 border-primary/20 hover:border-primary/50 hover:shadow-lg transition-all">
                            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <item.icon className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="font-headline">{item.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-8">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                                <Rocket className="text-primary"/>
                                Your Growth Engine
                            </CardTitle>
                             <CardDescription>
                                We provide the tools. You bring the hustle.
                             </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {growthHighlights.map((point, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                                    <span className="text-base">{point}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                     <Card className="bg-primary/10 border-primary/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                                <ShieldCheck />
                                 Our Promise to You
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <p>
                                We are committed to building a fair, transparent, and powerful platform for entrepreneurs. As a Founding Seller, your feedback will directly influence our development. We are your partners in growth.
                           </p>
                           <p className="font-bold">Let's build the future, together.</p>
                        </CardContent>
                    </Card>
                </div>
                
                <div>
                    <h2 className="text-center font-headline text-3xl font-bold mb-6">Your Roadmap to First Sales</h2>
                    <div className="relative">
                        <div className="hidden md:block absolute top-6 left-0 w-full h-0.5 bg-border border-dashed"></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8">
                            {roadmapSteps.map(item => (
                                <div key={item.step} className="text-center flex flex-col items-center">
                                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-3 z-10">{item.step}</div>
                                    <h3 className="font-semibold">{item.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="text-center pt-8 space-y-4 border-t">
                    <h2 className="font-headline text-2xl font-bold">Ready to Start Selling?</h2>
                     <div className="flex flex-col sm:flex-row justify-center gap-4">
                         <Button size="lg" className="font-bold" asChild>
                             <Link href="/dashboard/products?tab=add-new">Upload Your First Product</Link>
                         </Button>
                         <Button size="lg" variant="outline" className="font-bold" asChild>
                              <Link href="/dashboard/seller/settings">Customize Your Shop</Link>
                         </Button>
                     </div>
                </div>
            </div>
        </SellerLayout>
    );
}
