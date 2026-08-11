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

              {/* 2. Live Earnings and Activity Counters */}
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

            {/* 3. Interactive Global Creator Network Globe */}
            <div className="relative h-[400px] lg:h-[600px] flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-[120px] scale-75 opacity-30" />
                <GlobalCreatorGlobe />
            </div>
          </div>
        </section>

        {/* 4. Trending Videos Feed */}
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

        {/* 5. How Vidnov Works */}
        <section className="py-24 bg-background">
          <div className="container max-w-7xl mx-auto px-4 text-center space-y-16">
              <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-foreground">THE PROTOCOL</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {[
                      { icon: Video, title: "1. POST", desc: "Upload authentic product videos or host live shopping shows." },
                      { icon: Zap, title: "2. EARN", desc: "Trigger automated commissions. Your creative motion generates yield." },
                      { icon: Rocket, title: "3. REPEAT", desc: "Scale your merchant node and build a global social brand." }
                  ].map((step, i) => (
                      <div key={i} className="p-10 rounded-[3rem] bg-card border border-border hover:border-primary/20 transition-all shadow-sm">
                          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-8"><step.icon className="h-8 w-8" /></div>
                          <h3 className="font-black text-xl uppercase mb-3 text-foreground">{step.title}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold leading-relaxed uppercase tracking-widest">{step.desc}</p>
                      </div>
                  ))}
              </div>
          </div>
        </section>

        {/* 6. Featured Businesses & 7. Top Creators Leaderboard */}
        <section className="py-24 bg-muted/10 border-y border-border">
          <div className="container max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-20">
              <div className="space-y-8">
                  <h3 className="font-cyber text-3xl font-black uppercase tracking-tighter flex items-center gap-4 text-foreground text-left">
                    <Trophy className="text-yellow-500" /> TOP EARNERS
                  </h3>
                  <div className="space-y-4">
                      {LEADERBOARD.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-5 bg-card rounded-3xl border border-border shadow-sm hover:border-primary/20 transition-all">
                              <div className="flex items-center gap-4 text-left">
                                  <span className="font-cyber text-2xl font-black text-muted-foreground/20">#{i + 1}</span>
                                  <div className="relative h-14 w-14 shrink-0 rounded-2xl overflow-hidden border-2 border-primary/10">
                                      <Image src={c.avatar} alt={c.name} fill className="object-cover" />
                                  </div>
                                  <div>
                                      <p className="font-black text-sm uppercase tracking-tight text-foreground">{c.name}</p>
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{c.location}</p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="font-black text-primary text-xl tracking-tighter">{c.earnings}</p>
                                  <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">YIELD ACHIEVED</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="space-y-8">
                  <h3 className="font-cyber text-3xl font-black uppercase tracking-tighter flex items-center gap-4 text-foreground text-left">
                      <Store className="text-blue-600" /> FEATURED SHOPS
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-left">
                      {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="aspect-square relative rounded-[2rem] overflow-hidden border bg-card group cursor-pointer shadow-sm">
                              <Image src={`https://picsum.photos/seed/s${i}/400/400`} alt="shop" fill className="object-cover opacity-80 group-hover:opacity-100 transition-all duration-700" data-ai-hint="luxury store" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute bottom-4 left-4 right-4">
                                  <p className="text-white font-black text-[10px] uppercase tracking-widest">MERCHANT NODE 00{i}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
        </section>

        {/* 8. County and Country Activity Map */}
        <section className="py-24 bg-background">
            <div className="container max-w-7xl mx-auto px-4 text-center space-y-12">
                <div className="space-y-2 text-center">
                    <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter text-foreground">REGIONAL REACH</h2>
                    <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">Autonomous commerce nodes mapped by engagement density</p>
                </div>
                <div className="w-full bg-muted/10 rounded-[4rem] border border-border shadow-inner relative overflow-hidden flex items-center justify-center p-8">
                    <ActivityMap />
                </div>
            </div>
        </section>

        {/* 9. User Success Stories */}
        <section className="py-24 bg-primary/5">
          <div className="container max-w-7xl mx-auto px-4">
              <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter text-center mb-16 text-foreground">SUCCESS PROTOCOLS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                  {[
                      { name: 'Anita W.', role: 'Merchant', text: "Vidnov scaled my boutique from local to regional in 3 weeks. The video feed drives traffic 24/7 while I sleep." },
                      { name: 'John D.', role: 'Reseller', text: "I simply share links to high-quality tech gear. The commission logic is flawless and my payouts are instant." }
                  ].map((story, i) => (
                      <Card key={i} className="bg-card border-none rounded-[3rem] p-12 shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-8 opacity-5"><Quote className="h-20 w-20 text-primary" /></div>
                          <div className="space-y-6 relative z-10">
                              <p className="text-xl font-medium leading-relaxed italic text-foreground/80">"{story.text}"</p>
                              <div className="flex items-center gap-4">
                                  <div className="h-12 w-12 rounded-full bg-primary/10" />
                                  <div>
                                      <p className="font-black text-sm uppercase tracking-tight text-foreground">{story.name}</p>
                                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{story.role}</p>
                                  </div>
                              </div>
                          </div>
                      </Card>
                  ))}
              </div>
          </div>
        </section>

        {/* 10. AI-Powered Content Recommendations */}
        <section className="py-24 border-y border-border">
            <div className="container max-w-7xl mx-auto px-4 text-left">
                <div className="flex items-center gap-3 mb-12">
                    <BrainCircuit className="h-6 w-6 text-primary animate-pulse" />
                    <h3 className="font-cyber text-2xl font-black uppercase tracking-tighter text-foreground">AI RECOMMENDATION LOOP</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-8 scrollbar-hide">
                    {['Streetwear Trends', 'Next-Gen Audio', 'Smart Living', 'Urban Fitness', 'Digital Art', 'Pet Tech'].map(tag => (
                        <div key={tag} className="flex-shrink-0 px-8 py-10 rounded-[2.5rem] bg-card border border-border shadow-sm hover:border-primary transition-all flex flex-col items-center gap-4 group cursor-pointer min-w-[200px]">
                            <LayoutGrid className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground">{tag}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* 11. Call-to-Action for Video Uploads and Promotions */}
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
