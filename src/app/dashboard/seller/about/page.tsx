
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ShoppingBag, Video, Users, MessageSquare, Package, BarChart, Bell, Settings, Award, Info, Rocket, Film, BookOpen, TrendingUp, Sparkles, Trophy, HelpCircle, ShieldAlert, User, Star, Zap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const sellerBenefits = [
    { icon: ShoppingBag, title: "Upload & Sell Instantly", description: "Add videos, images & descriptions. Show real value—buyers love authenticity." },
    { icon: Video, title: "Go Live & Earn More", description: "Engage in real-time selling with live chat and Q&A to boost your sales." },
    { icon: Users, title: "Work With Resellers", description: "Let resellers promote your items. You only pay a commission when they make a sale." },
    { icon: MessageSquare, title: "Chat With Buyers", description: "Receive messages instantly, answer questions fast, and build trust to increase conversions." },
    { icon: Package, title: "Simple Order Management", description: "Track new orders, update shipping status, and handle returns all in one place." },
    { icon: BarChart, title: "Dashboard Insights", description: "Access sales analytics, view top products, and understand buyer behavior." },
];

const growthHighlights = [
    { icon: Film, text: "Video-First Selling" },
    { icon: Users, text: "Reseller Partnerships" },
    { icon: Rocket, text: "Boosted Product Exposure" },
    { icon: Settings, text: "Easy Shop Customization" },
    { icon: BarChart, text: "Real Sales Insights" },
    { icon: ShieldCheck, text: "Secure Payments" },
]

const roadmapSteps = [
    { step: 1, title: "Complete Your Shop Profile", description: "Add a banner, logo, and description to build your brand." },
    { step: 2, title: "Upload Your First Product", description: "Video uploads are highly recommended to increase trust." },
    { step: 3, title: "Set Stock & Price", description: "Use our simple form with auto-calculated fees." },
    { step: 4, title: "Enable Reseller Program", description: "Let others promote your items and expand your reach." },
    { step: 5, title: "Go Live to Boost Sales", description: "Reach more people instantly with a live session." },
    { step: 6, title: "Share Your Shop Link", description: "Use your unique MoneyGo link to drive external traffic." },
]

export default function SellerAboutPage() {
    const sellerName = "Seller"; // Placeholder, will be dynamic later

    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                {/* Welcome Header */}
                <div className="text-center space-y-2">
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight">
                        🎉 Welcome to Go Earn Seller Hub!
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Your journey to selling faster, smarter, and globally starts now.
                    </p>
                </div>

                {/* Personalized Greeting */}
                <div className="text-center">
                    <h2 className="font-headline text-3xl font-bold">Hi, {sellerName}! Let’s grow your business.</h2>
                    <p className="text-md text-muted-foreground mt-1">Upload products, go live, let resellers promote your items, and watch your sales grow.</p>
                </div>
                
                {/* Benefits Section */}
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

                {/* Grow with Go Earn & Highlights */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Why Sellers Choose Go Earn</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                "0% listing fees",
                                "Unlimited product uploads",
                                "TikTok-like product exposure",
                                "Real-time buyer interaction",
                                "Strong anti-scam protection",
                                "Support for video-first selling"
                            ].map((point, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-sm">{point}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>🔥 Platform Highlights</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                           {growthHighlights.map((item, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                    <item.icon className="h-5 w-5 text-primary" />
                                    <span className="text-sm font-medium">{item.text}</span>
                                </div>
                           ))}
                        </CardContent>
                    </Card>
                </div>
                
                {/* Seller Roadmap */}
                <div>
                    <h2 className="text-center font-headline text-3xl font-bold mb-6">Your Roadmap to Success</h2>
                    <div className="relative">
                        {/* Desktop Dashed Line */}
                        <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-border border-dashed"></div>
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

                {/* Call to Action */}
                <div className="text-center pt-8 space-y-4">
                    <h2 className="font-headline text-2xl font-bold">Ready to Start?</h2>
                     <div className="flex justify-center gap-4">
                         <Button size="lg" className="font-bold" asChild>
                             <Link href="/dashboard/products">Upload Your First Product</Link>
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
