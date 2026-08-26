
'use client';

import { useEffect, useState } from "react";
import { 
  Video, Zap, Rocket, ChevronRight, Trophy, Sparkles, 
  MapPin, BrainCircuit, LayoutGrid, Store, Quote, 
  Activity, Globe as GlobeIcon, Users, Star,
  TrendingUp, ShieldCheck, ArrowRight, MousePointer2
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

const GlobalCreatorGlobe = dynamic(() => import('@/components/home/global-creator-globe'), { 
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex flex-col items-center justify-center bg-muted/5 rounded-[3rem]">
            <Activity className="h-8 w-8 animate-pulse text-primary opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-4">Calibrating Signal...</p>
        </div>
    )
});

const ActivityMap = dynamic(() => import('@/components/home/world-map'), {
    ssr: false,
    loading: () => <div className="aspect-[21/9] w-full bg-muted/10 rounded-[3rem] animate-pulse" />
});

const TRENDING_VIDEOS = [
    { id: 1, title: 'Urban Tech Essentials', creator: '@VoltStyle', price: '$85.00', img: 'https://picsum.photos/seed/v1/600/800', hint: 'tech fashion' },
    { id: 2, title: 'Minimalist Work Space', creator: '@SiliconHub', price: '$299.00', img: 'https://picsum.photos/seed/v2/600/800', hint: 'clean office' },
    { id: 3, title: 'Artisan Brew Series', creator: '@BeanCode', price: '$12.50', img: 'https://picsum.photos/seed/v3/600/800', hint: 'coffee beans' },
    { id: 4, title: 'Velocity Running Kit', creator: '@SwiftStride', price: '$145.00', img: 'https://picsum.photos/seed/v4/600/800', hint: 'running shoes' },
];

const LEADERBOARD = [
    { name: 'David Kamiano', earnings: '$12,450', location: 'Nairobi', avatar: 'https://picsum.photos/seed/u1/100/100' },
    { name: 'Sarah Jepchirchir', earnings: '$9,200', location: 'Mombasa', avatar: 'https://picsum.photos/seed/u2/100/100' },
    { name: 'Mike Ross', earnings: '$7,800', location: 'Lagos', avatar: 'https://picsum.photos/seed/u3/100/100' },
];

export default function VidnovHomePage() {
  const [liveYield, setLiveYield] = useState(12450.80);

  useEffect(() => {
    const interval = setInterval(() => {
        setLiveYield(prev => prev + Math.random() * 0.85);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <LandingLayout>
      <div className="bg-background text-foreground overflow-x-hidden animate-in fade-in duration-1000">
        
        {/* 1. Hero Banner */}
        <section className="relative pt-12 pb-24 lg:pt-20 lg:pb-32 bg-gradient-to-b from-primary/5 via-transparent to-transparent">
          <div className="container max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-left space-y-8">
              <Badge variant="secondary" className="px-4 py-1.5 rounded-full bg-primary/10 text-primary border-none font-bold uppercase tracking-widest text-[10px]">
                <Sparkles className="h-3 w-3 mr-2 inline" />
                FOUNDING SELLER BONUS: +1,000 AI POINTS
              </Badge>
              
              <h1 className="font-headline text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85] text-foreground">
                POST. <span className="text-primary italic">EARN.</span>
                <br />
                REPEAT.
              </h1>
              
              <p className="max-w-xl text-lg text-muted-foreground font-medium leading-relaxed">
                Vidnov is the world's next-generation social commerce protocol. We transform creative motion into verified financial yield. 
              </p>

              <div className="flex flex-wrap gap-4">
                  <div className="p-5 rounded-3xl bg-card border shadow-sm flex flex-col gap-1 min-w-[220px]">
                      <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">NETWORK YIELD</p>
                      <p className="text-3xl font-black font-cyber text-foreground">${liveYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-card border shadow-sm flex flex-col gap-1 min-w-[180px]">
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em]">ACTIVE NODES</p>
                      <p className="text-3xl font-black font-cyber text-foreground">1,248</p>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 group border-none" asChild>
                  <Link href="/signup?role=seller">
                    START EARNING <Video className="ml-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs border-primary/20" asChild>
                    <Link href="/buyer/dashboard">EXPLORE CATALOG</Link>
                </Button>
              </div>
            </div>

            <div className="relative h-[400px] lg:h-[600px] flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-[120px] scale-75 opacity-30" />
                <GlobalCreatorGlobe />
            </div>
          </div>
        </section>

        {/* Trending Videos Feed */}
        <section className="py-24 border-y border-border bg-muted/5">
          <div className="container max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between mb-12">
                  <div className="space-y-1">
                      <h2 className="font-cyber text-3xl font-black uppercase tracking-tighter text-foreground">TRENDING MOTION</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">High-velocity commerce discovery</p>
                  </div>
                  <Button variant="link" className="font-black uppercase tracking-widest text-[10px] text-primary" asChild>
                      <Link href="/buyer/dashboard">VIEW ALL FEED <ChevronRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {TRENDING_VIDEOS.map((vid) => (
                      <div key={vid.id} className="group relative aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-card border border-border shadow-lg hover:border-primary transition-all duration-500">
                          <Image src={vid.img} alt={vid.title} fill className="object-cover opacity-90 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105" data-ai-hint={vid.hint} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                          <div className="absolute bottom-6 left-6 right-6 text-left space-y-2">
                              <Badge className="bg-red-600 animate-pulse border-none text-[8px] font-black uppercase text-white">LIVE</Badge>
                              <p className="text-white font-black uppercase text-lg tracking-tight leading-none truncate">{vid.title}</p>
                              <div className="flex items-center justify-between text-white/70">
                                  <span className="text-[9px] font-bold uppercase tracking-widest">{vid.creator}</span>
                                  <span className="text-primary font-black text-sm">{vid.price}</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        </section>

        {/* Call-to-Action */}
        <section className="py-32 bg-neutral-900 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 opacity-40 animate-pulse" />
            <div className="container max-w-4xl mx-auto px-4 text-center relative z-10 space-y-12">
                <h2 className="font-headline text-4xl md:text-7xl font-black uppercase tracking-tighter leading-[0.85]">
                    READY TO
                    <br />
                    POST & EARN?
                </h2>
                <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
                     <Button size="lg" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 group border-none" asChild>
                        <Link href="/signup?role=seller">
                            START UPLOADING <Rocket className="ml-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                        </Link>
                    </Button>
                    <Button size="lg" variant="outline" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-widest text-sm border-white/20 bg-white/5 hover:bg-white/10 text-white" asChild>
                        <Link href="/features">LEARN MORE</Link>
                    </Button>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Join 12,000+ creators scaling their revenue today</p>
            </div>
        </section>
      </div>
      <CookieConsentBanner />
    </LandingLayout>
  );
}
