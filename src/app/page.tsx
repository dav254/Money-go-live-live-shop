'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Rocket, Video, Zap, 
  Radio, Globe, RadioTower, Bot, Eye, Loader2, 
  Shield, CreditCard, Target, PlayCircle, 
  Activity, ArrowUpRight, CheckCircle2,
  Play, Tag, ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import dynamic from 'next/dynamic';
import placeholderData from '@/app/lib/placeholder-images.json';
import Image from 'next/image';

const GlobalSignalHub = dynamic(() => import("@/components/home/global-signal-hub"), { 
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-neutral-900/20 animate-pulse rounded-[3rem]" />
});

const LiveMarketplaceDemo = () => {
    const items = placeholderData.demoItems || [];
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-12">
            {items.map((item, i) => (
                <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="group relative aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl hover:border-primary/50 transition-all duration-500"
                >
                    <Image 
                        src={item.url} 
                        alt="Demo Item" 
                        fill 
                        className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                        data-ai-hint={item.hint}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    
                    <div className="absolute top-4 left-4">
                        <Badge className="bg-red-600 hover:bg-red-700 animate-pulse border-none px-3 py-1 font-black uppercase tracking-widest text-[9px]">
                            <Radio className="mr-1.5 h-3 w-3" /> LIVE
                        </Badge>
                    </div>

                    <div className="absolute bottom-6 left-6 right-6 space-y-3">
                        <div className="flex items-center gap-2">
                             <div className="h-2 w-2 rounded-full bg-primary" />
                             <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Discovery Signal</span>
                        </div>
                        <div className="flex items-end justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate">{item.hint}</p>
                                <p className="text-3xl font-black text-white tracking-tighter leading-none mt-1">
                                    ${(Math.random() * 500 + 20).toFixed(0)}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
                                <ShoppingBag className="h-6 w-6 text-white" />
                            </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

const LiveTicker = () => {
  const [tickerIndex, setTickerIndex] = useState(0);
  const activities = [
    "LIVE SALE: $120.00 IN NAIROBI",
    "NEW SIGNAL: TECHUNBOXED IS LIVE",
    "INSTANT PAYOUT: $450.00 COMPLETED",
    "AI SYNC: 142 NEW PRODUCTS INDEXED",
    "GLOBAL DISCOVERY: 12K ACTIVE VIEWERS"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % activities.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activities.length]);

  return (
    <div className="w-full bg-primary/10 border-y border-primary/20 backdrop-blur-md h-10 flex items-center overflow-hidden">
      <div className="container max-w-7xl mx-auto flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-primary animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-primary font-cyber">Platform Pulse</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p 
              key={tickerIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-[9px] font-bold text-white/70 uppercase tracking-tighter"
            >
              {activities[tickerIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">
           <span>Signal Status: <span className="text-green-500">OPTIMAL</span></span>
           <span>Latency: <span className="text-white">12ms</span></span>
        </div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') return;

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

  if (!isMounted || isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black">
        <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Initializing Signal</p>
      </div>
    );
  }

  return (
    <LandingLayout>
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-black">
        <div 
          className="animate-aurora opacity-40"
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(ellipse at 30% 40%, hsla(24, 100%, 55%, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, hsla(320, 100%, 60%, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, hsla(200, 100%, 55%, 0.1) 0%, transparent 40%)'
          }}
        />
        <div className="absolute top-0 left-0 w-full h-full cyber-grid opacity-20" />
      </div>

      <LiveTicker />
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center pt-12 px-4">
        <div className="container max-w-6xl mx-auto text-center space-y-10">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl"
          >
            <Sparkles className="h-3 w-3 text-primary animate-spin-slow" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 font-cyber">The Future of Content is Commerce</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <h1 className="font-cyber text-6xl md:text-9xl font-black uppercase tracking-tighter leading-none">
              <span className="text-white">POST EARN</span>
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
            <p className="max-w-3xl mx-auto text-lg md:text-2xl text-neutral-400 font-medium leading-relaxed [text-wrap:balance]">
              Static shops are ghosts of the past. GoEarn is the <span className="text-white font-bold">Content Engine</span> that transforms your authentic videos into a 24/7 revenue stream. 
              <span className="text-primary font-black italic ml-1 underline decoration-primary/30">Join as a Seller and get 1,000 Free AI Points.</span>
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4"
          >
            <Button size="lg" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm bg-primary hover:bg-primary/90 text-white shadow-[0_0_50px_rgba(255,107,0,0.3)] group relative overflow-hidden" asChild>
              <Link href="/signup?role=seller">
                <span className="relative z-10 flex items-center gap-2">
                   CLAIM YOUR 1000 PTS <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Link>
            </Button>
            <Button 
                asChild
                size="lg" 
                variant="outline" 
                className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-xl group"
            >
                <Link href="/buyer/dashboard">
                  BROWSE MARKETPLACE <Play className="ml-3 h-5 w-5 fill-white group-hover:scale-125 transition-transform animate-pulse" />
                </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Live Marketplace Demo Section */}
      <section className="py-24 px-4 border-y border-white/5 bg-neutral-950/30">
          <div className="container max-w-7xl mx-auto">
              <div className="flex items-end justify-between mb-12">
                  <div className="space-y-4">
                      <Badge variant="outline" className="text-primary border-primary/30 font-black uppercase text-[10px] px-4">LIVE DISCOVERY</Badge>
                      <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter text-white">READY FOR <span className="text-primary italic">YIELD</span></h2>
                  </div>
              </div>
              <LiveMarketplaceDemo />
          </div>
      </section>

      <section className="py-24 px-4 overflow-hidden">
        <div className="container max-w-7xl mx-auto">
          <GlobalSignalHub />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-48 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
          <div className="container max-w-5xl mx-auto text-center space-y-16 relative z-10">
              <h3 className="font-cyber text-5xl md:text-8xl font-black uppercase tracking-tighter text-white leading-none">
                  JOIN THE <span className="text-primary italic">FLEET</span>
              </h3>
              <p className="text-neutral-400 max-w-2xl mx-auto font-medium text-xl leading-relaxed">
                  GoEarn is now accepting a limited number of <span className="text-white font-bold underline decoration-primary/50 underline-offset-8">Founding Merchants.</span> 
                  Receive priority discovery placement and exclusive performance bonuses for life.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-6">
                <Button size="lg" className="h-24 px-16 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-lg bg-white text-black hover:bg-neutral-200 shadow-[0_0_80px_rgba(255,255,255,0.1)] transition-all active:scale-95 group" asChild>
                    <Link href="/signup?role=seller">
                        INITIALIZE SHOP <ArrowUpRight className="ml-3 h-6 w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </Link>
                </Button>
              </div>
          </div>
      </section>
    </LandingLayout>
  );
}
