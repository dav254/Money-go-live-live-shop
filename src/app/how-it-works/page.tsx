'use client';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Video, 
  Sparkles, 
  Rocket, 
  CircleDollarSign, 
  ShoppingBag, 
  ShieldCheck, 
  Truck, 
  ArrowRight,
  MonitorPlay,
  Zap,
  CheckCircle2,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const sellerSteps = [
    {
        icon: Video,
        title: "Post Your Reality",
        description: "Upload raw, authentic product videos. No filters, no professional edits—just real items shown in real settings to build massive trust."
    },
    {
        icon: Sparkles,
        title: "AI-Augmented Logic",
        description: "Use your free AI points to generate viral captions and SEO-ready descriptions. Let our neural network find your perfect buyer."
    },
    {
        icon: Rocket,
        title: "Global Discovery",
        description: "Your videos enter the main discovery feed instantly. We map your products to shoppers based on intent, location, and behavior."
    },
    {
        icon: CircleDollarSign,
        title: "Automated Payouts",
        description: "When a sale clears, your revenue is added to your wallet. Withdraw directly via M-Pesa or Bank—no long waits, no manual invoices."
    }
];

const buyerSteps = [
    {
        icon: MonitorPlay,
        title: "Watch & Shop",
        description: "Swipe through a personalized video feed. If you see it and you like it, you can buy it with one click directly from the video."
    },
    {
        icon: ShieldCheck,
        title: "Verified Trust",
        description: "Shop exclusively from verified merchants. Our 'Reality Check' video policy ensures that what you see in the clip is exactly what arrives."
    },
    {
        icon: Zap,
        title: "Frictionless Pay",
        description: "Checkout in seconds using M-Pesa or Global Cards. Your funds are held securely by GoEarn until delivery is confirmed."
    },
    {
        icon: Truck,
        title: "Live Tracking",
        description: "Track your shipment from the merchant's door to yours. Get real-time notifications at every stage of the fulfillment pipeline."
    }
];

export default function HowItWorksPage() {
  return (
    <LandingLayout>
      <div className="bg-black text-white min-h-screen">
        {/* Hero Section */}
        <section className="relative py-24 px-4 overflow-hidden border-b border-white/5">
            <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full opacity-50 -translate-y-1/2" />
            <div className="container max-w-5xl mx-auto text-center relative z-10 space-y-6">
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.3em] text-[10px] px-4 py-1.5 rounded-full">The Protocol</Badge>
                <h1 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-tight">
                    HOW <span className="text-gradient">GOEARN</span> WORKS
                </h1>
                <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto font-medium">
                    We've automated the bridge between social engagement and commercial yield. 
                    Discovery has never been this authentic.
                </p>
            </div>
        </section>

        {/* Merchant Path */}
        <section className="py-32 px-4 container max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                <div className="lg:col-span-4 space-y-6 sticky top-32">
                    <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter text-white">
                        THE <span className="text-primary italic">MERCHANT</span> JOURNEY
                    </h2>
                    <p className="text-neutral-500 font-bold text-sm uppercase tracking-widest leading-relaxed">
                        Transform your inventory into a global broadcast. Use AI to scale your reach and get paid instantly.
                    </p>
                    <Button size="lg" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20" asChild>
                        <Link href="/signup?role=seller">START SELLING NOW</Link>
                    </Button>
                </div>
                
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sellerSteps.map((step, i) => (
                        <Card key={i} className="bg-neutral-900/40 border-white/5 hover:border-primary/30 transition-all rounded-[2.5rem] group">
                            <CardHeader className="p-8">
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary transition-all">
                                    <step.icon className="h-7 w-7 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <CardTitle className="font-black uppercase tracking-tight text-white text-xl">{step.title}</CardTitle>
                                <CardDescription className="text-neutral-500 font-medium leading-relaxed pt-2">
                                    {step.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </div>
        </section>

        {/* Founding Seller CTA */}
        <section className="py-20 px-4">
            <div className="container max-w-6xl mx-auto">
                <div className="bg-primary/10 border border-primary/20 rounded-[3rem] p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute -right-20 -bottom-20 opacity-10 rotate-12">
                        <Rocket className="h-96 w-96 text-primary" />
                    </div>
                    <div className="space-y-4 relative z-10 max-w-xl text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest">
                            <Sparkles className="h-3 w-3" /> Founding Member Offer
                        </div>
                        <h3 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">GET 1,000 FREE AI POINTS</h3>
                        <p className="text-neutral-400 font-medium text-lg">Join today as a seller and receive a welcome bonus to fuel your first 10 viral video descriptions.</p>
                    </div>
                    <Button size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs relative z-10 shadow-2xl" asChild>
                        <Link href="/signup?role=seller">CLAIM MY POINTS</Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Shopper Path */}
        <section className="py-32 px-4 container max-w-7xl mx-auto border-t border-white/5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                 <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 order-2 lg:order-1">
                    {buyerSteps.map((step, i) => (
                        <Card key={i} className="bg-neutral-900/40 border-white/5 hover:border-blue-500/30 transition-all rounded-[2.5rem] group">
                            <CardHeader className="p-8">
                                <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-500 transition-all">
                                    <step.icon className="h-7 w-7 text-blue-500 group-hover:text-white transition-colors" />
                                </div>
                                <CardTitle className="font-black uppercase tracking-tight text-white text-xl">{step.title}</CardTitle>
                                <CardDescription className="text-neutral-500 font-medium leading-relaxed pt-2">
                                    {step.description}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>

                <div className="lg:col-span-4 space-y-6 sticky top-32 order-1 lg:order-2">
                    <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter text-white">
                        THE <span className="text-blue-500 italic">SHOPPER</span> EXPERIENCE
                    </h2>
                    <p className="text-neutral-500 font-bold text-sm uppercase tracking-widest leading-relaxed">
                        Discover products through pure motion. Buy with confidence from verified local sellers with integrated local payments.
                    </p>
                    <Button size="lg" variant="outline" className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10 bg-white/5 text-white" asChild>
                        <Link href="/buyer/dashboard">EXPLORE FEED</Link>
                    </Button>
                </div>
            </div>
        </section>

        {/* Final CTA */}
        <section className="py-40 px-4 text-center space-y-12">
            <div className="space-y-6">
                <h3 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">READY TO <span className="text-primary">SYNC?</span></h3>
                <p className="text-neutral-500 max-w-xl mx-auto font-bold uppercase tracking-widest text-xs">Choose your entry point into the GoEarn ecosystem</p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Button size="lg" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-white text-black hover:bg-neutral-200 shadow-2xl" asChild>
                    <Link href="/signup?role=seller">JOIN AS SELLER</Link>
                </Button>
                <Button size="lg" variant="outline" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-widest text-sm border-white/10 bg-white/5 text-white" asChild>
                    <Link href="/signup?role=buyer">JOIN AS BUYER</Link>
                </Button>
            </div>
        </section>

      </div>
    </ProjectFooter>
  );
}

// Internal temporary helper to allow layout wrapping without circular dependencies
function ProjectFooter({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-1">
                {children}
            </main>
            <footer className="py-20 border-t border-white/5 bg-black">
                <div className="container max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <span className="font-cyber font-black text-white text-xl tracking-tighter">GO<span className="text-primary">EARN</span></span>
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-700">© 2026 THE FUTURE OF COMMERCE</p>
                    </div>
                    <div className="flex items-center gap-8">
                        <Link href="/features" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">Features</Link>
                        <Link href="/faq" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">FAQ</Link>
                        <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">Terms</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
