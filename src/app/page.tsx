
'use client';

import { useEffect } from "react";
import { 
  ArrowRight, Sparkles, Zap, 
  Video, Users, Globe,
  Bot, Loader2, ShoppingBag, CreditCard, Play, DollarSign
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else {
        router.replace('/buyer/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const feed = [
    {
      type: "video",
      title: "How I Earned KES 5,000 Today",
      author: "Sarah J.",
      icon: Video,
      color: "text-blue-500"
    },
    {
      type: "business",
      title: "New Gadget Promo - 20% Commission",
      author: "Tech Africa",
      icon: ShoppingBag,
      color: "text-purple-500"
    },
    {
      type: "job",
      title: "Content Creator Needed",
      author: "Fashion Hub",
      icon: Users,
      color: "text-green-500"
    },
    {
      type: "earning",
      title: "Refer & Unlock 500 AI Points",
      author: "Go Earn",
      icon: DollarSign,
      color: "text-yellow-500"
    },
  ];

  return (
    <LandingLayout>
      <div className="min-h-screen bg-neutral-950 text-white selection:bg-primary selection:text-white">
        {/* Real-time Earning Ticker */}
        <div className="bg-primary/10 border-b border-primary/20 py-2 overflow-hidden whitespace-nowrap">
            <div className="animate-float-slow inline-flex gap-12 items-center px-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                        <Zap className="h-3 w-3" />
                        Aisha just earned $15 in Nairobi
                        <span className="text-white/30">•</span>
                        John just sold 5 units in Lagos
                    </div>
                ))}
            </div>
        </div>

        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,87,34,0.1),transparent_70%)] pointer-events-none" />
          
          <div className="container mx-auto max-w-6xl text-center relative z-10">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] mb-8 animate-fade-in">
                <Sparkles className="h-3 w-3 text-primary" />
                Social Commerce v2.0
            </div>
            
            <h1 className="font-cyber text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
              DISCOVER <br />
              <span className="text-gradient glow-text">OPPORTUNITIES</span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-neutral-400 text-lg md:text-xl font-medium leading-relaxed mb-12">
              The world's first video-driven marketplace where <br className="hidden md:block" /> 
              <span className="text-white font-bold">videos, jobs, and earnings</span> happen in real-time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button asChild size="lg" className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/20 group">
                    <Link href="/signup?role=seller">
                        Start Earning <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-16 px-10 rounded-2xl border-white/10 hover:bg-white/5 font-black uppercase tracking-widest">
                    <Link href="/buyer/dashboard">Browse Feed</Link>
                </Button>
            </div>
          </div>
        </section>

        {/* Opportunity Feed Section */}
        <section className="container mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-center justify-between mb-12">
            <div className="space-y-1">
                <h2 className="font-cyber text-2xl md:text-3xl font-black uppercase tracking-tighter">Opportunity Feed</h2>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Live updates from the network</p>
            </div>
            <div className="h-px flex-1 bg-white/5 mx-8 hidden md:block" />
            <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/20 bg-primary/5 text-primary font-black uppercase tracking-widest text-[10px]">
                LIVE NOW
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {feed.map((item, index) => (
              <Card key={index} className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all group rounded-2xl overflow-hidden shadow-2xl">
                <CardContent className="p-6">
                  <div className={cn("p-3 rounded-xl bg-white/5 w-fit mb-4 group-hover:scale-110 transition-transform", item.color)}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2 block">{item.type}</span>
                  <h3 className="text-base font-black uppercase tracking-tight leading-tight mb-4 group-hover:text-primary transition-colors">{item.title}</h3>
                  <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                      <div className="h-5 w-5 rounded-full bg-neutral-800" />
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">By {item.author}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Immersive Discovery Section */}
        <section className="bg-white text-black py-24 px-6 rounded-[3rem] mx-4 mb-20 shadow-2xl overflow-hidden relative group">
             <div className="container mx-auto max-w-6xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8 text-center lg:text-left">
                        <Badge className="bg-black text-white border-none font-black uppercase tracking-[0.3em] px-4 py-1">THE STUDIO</Badge>
                        <h2 className="font-cyber text-4xl md:text-6xl font-black tracking-tighter uppercase leading-[0.9]">
                            DON'T JUST SELL. <br />
                            <span className="text-primary">GO LIVE.</span>
                        </h2>
                        <p className="text-neutral-600 text-lg font-medium leading-relaxed">
                            Buyers crave authenticity. Use our high-fidelity live selling tools to show real products, answer real questions, and close deals in seconds.
                        </p>
                        <div className="grid grid-cols-2 gap-6 pt-4">
                            <div className="space-y-2">
                                <p className="text-3xl font-black tracking-tighter">10X</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">More Engagement</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-3xl font-black tracking-tighter">0%</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Listing Fees</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative aspect-[9/16] max-w-[320px] mx-auto w-full bg-black rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-[8px] border-neutral-900 overflow-hidden group">
                        <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
                        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-transparent to-transparent p-6 flex flex-col justify-end">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-full border-2 border-primary bg-neutral-800 overflow-hidden" />
                                <div>
                                    <p className="text-white font-black text-xs uppercase tracking-tight">Luxury Watches</p>
                                    <p className="text-primary font-black text-[10px] uppercase tracking-widest animate-pulse">LIVE NOW</p>
                                </div>
                            </div>
                            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-between">
                                <p className="text-white font-black text-sm">$299</p>
                                <Button size="sm" className="bg-primary text-[10px] font-black uppercase h-8 px-4 rounded-xl border-none">BUY NOW</Button>
                            </div>
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 bg-primary rounded-full flex items-center justify-center shadow-2xl scale-0 group-hover:scale-100 transition-transform duration-500">
                            <Play className="h-6 w-6 text-white fill-white" />
                        </div>
                    </div>
                </div>
             </div>
        </section>

        {/* Feature Grid */}
        <section className="container mx-auto max-w-6xl px-6 py-20 pb-40 text-center">
            <h2 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter mb-16">
                BUILT FOR THE <span className="text-primary">HUSTLE</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { title: "AI TOOLKIT", desc: "Generate viral captions, product descriptions, and ad-ready videos in one click.", icon: Bot },
                    { title: "SECURE PAYOUTS", desc: "Get your earnings instantly through M-Pesa or PayPal with our verified ledger.", icon: CreditCard },
                    { title: "GLOBAL REACH", desc: "Let our network of resellers amplify your products to millions of buyers.", icon: Globe },
                ].map((f, i) => (
                    <div key={i} className="p-8 rounded-[2rem] bg-white/5 border border-white/5 hover:border-primary/20 transition-all text-left group">
                        <f.icon className="h-8 w-8 text-primary mb-6 group-hover:scale-110 transition-transform" />
                        <h3 className="font-black uppercase tracking-tight text-lg mb-4">{f.title}</h3>
                        <p className="text-neutral-500 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>
        </section>
      </div>
    </LandingLayout>
  );
}
