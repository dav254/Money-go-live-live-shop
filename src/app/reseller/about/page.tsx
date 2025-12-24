'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2, DollarSign, TrendingUp, BarChart, Rocket, CheckCircle, Sparkles, BookOpen } from 'lucide-react';
import Link from 'next/link';

const resellerBenefits = [
    { icon: Share2, title: "Share & Earn", description: "Grab your unique link for any product and share it on WhatsApp, TikTok, or anywhere online." },
    { icon: DollarSign, title: "Instant Commissions", description: "You earn a commission for every single sale made through your links. No hidden fees." },
    { icon: BarChart, title: "Track Your Performance", description: "Use your dashboard to see your clicks, sales, and total earnings in real-time." },
    { icon: Sparkles, title: "AI-Powered Tools", description: "Use our AI Toolkit to generate viral captions and content to boost your shares and sales." },
];

const howItWorks = [
    { step: 1, title: "Find a Product", description: "Browse products with high commission rates in the 'Products to Resell' tab." },
    { step: 2, title: "Share Your Link", description: "Click the 'Share' button to copy your unique link for that product." },
    { step: 3, title: "Promote Everywhere", description: "Post your link on WhatsApp Status, TikTok, Instagram—wherever your audience is." },
    { step: 4, title: "Get Paid", description: "When someone buys through your link, the commission is added to your wallet automatically." },
];


export default function ResellerAboutPage() {
    const resellerName = "Reseller"; // Placeholder

    return (
        <ResellerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                
                <div className="text-center space-y-2 py-8">
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight">
                        Welcome to the Go Earn Reseller Program
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Turn your social influence into real cash. Share products, drive sales, and earn commissions. It's that simple.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {resellerBenefits.map((item, index) => (
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

                 <div className="py-8">
                    <h2 className="text-center font-headline text-3xl font-bold mb-8">How It Works: Your 4 Steps to Earning</h2>
                    <div className="relative">
                         <div className="hidden md:block absolute top-6 left-0 w-full h-0.5 bg-border border-dashed"></div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {howItWorks.map(item => (
                                <div key={item.step} className="text-center flex flex-col items-center z-10">
                                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-3">{item.step}</div>
                                    <h3 className="font-semibold">{item.title}</h3>
                                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-8">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                                <Rocket className="text-primary"/>
                                Your Growth Engine
                            </CardTitle>
                             <CardDescription>
                                We give you the tools. You bring the hustle.
                             </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-primary flex-shrink-0" /><span>Zero startup cost. Start earning today.</span></div>
                            <div className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-primary flex-shrink-0" /><span>Access to thousands of products.</span></div>
                            <div className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-primary flex-shrink-0" /><span>Real-time dashboard to track all your stats.</span></div>
                             <div className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-primary flex-shrink-0" /><span>Fast and secure payouts to your wallet.</span></div>
                        </CardContent>
                    </Card>
                     <Card className="bg-primary/10 border-primary/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                               <BookOpen />
                                Go Earn Academy
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           <p>
                                Want to learn the secrets of top resellers? Visit the Go Earn Academy for free video courses and tutorials on how to sell effectively on WhatsApp, TikTok, and more.
                           </p>
                           <Button asChild variant="secondary">
                               <Link href="/dashboard/reseller/support/academy">Start Learning</Link>
                           </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center pt-8 space-y-4 border-t">
                    <h2 className="font-headline text-2xl font-bold">Ready to Start Earning?</h2>
                     <div className="flex flex-col sm:flex-row justify-center gap-4">
                         <Button size="lg" className="font-bold" asChild>
                             <Link href="/dashboard/reseller/products">Find a Product to Share</Link>
                         </Button>
                         <Button size="lg" variant="outline" className="font-bold" asChild>
                              <Link href="/dashboard/reseller/commissions">View My Earnings</Link>
                         </Button>
                     </div>
                </div>
            </div>
        </ResellerLayout>
    );
}
