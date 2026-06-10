'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Video, Zap, 
  Radio, Globe, RadioTower, Eye, Loader2, 
  Shield, CreditCard, Activity, ArrowUpRight,
  TrendingUp, ShoppingBag, Flame, CheckCircle
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';
import placeholderData from '@/app/lib/placeholder-images.json';

const GlobalSignalHub = dynamic(() => import("@/components/home/global-signal-hub"), { 
    ssr: false,
    loading: () => <div className="h-[600px] w-full bg-neutral-900/20 rounded-[3rem] animate-pulse" />
});

const LiveMarketplaceDemo = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;

    const demoItems = placeholderData.demoItems || [];

    return (
        <section className="py-24 px-4 relative overflow-hidden">
            <div className="container max-w-7xl mx-auto">
                <div className="mb-16 text-center space-y-4">
                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.4em] text-[10px] px-5 py-2 rounded-full">
                        Global Discovery Flow
                    </Badge>
                    <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">
                        LIVE <span className="text-primary glow-text">STREAM</span>
                    </h2>
                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs max-w-xl mx-auto">
                        Real-time signals from verified merchants. What you see is exactly what you get.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                    {demoItems.map((item, i) => (
                        <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-white/5 group shadow-2xl bg-neutral-900"
                        >
                             <img 
                                src={item.url} 
                                alt={item.id} 
                                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70" 
                                data-ai-hint={item.hint}
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                             
                             <div className="absolute top-6 left-6">
                                <Badge className="bg-red-600 hover:bg-red-700 border-none animate-pulse font-black text-[10px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xl">
                                    <div className="h-2 w-2 rounded-full bg-white" /> LIVE
                                </Badge>
                             </div>

                             <div className="absolute bottom-8 left-8 right-8 space-y-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="h-4 w-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                                        <TrendingUp className="h-2 w-2 text-primary" />
                                    </div>
                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] truncate">GOEARN VERIFIED</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-2xl font-black text-white font-cyber tracking-tighter">${(40 + (i * 25)).toFixed(2)}</p>
                                    <Button size="icon" className="h-10 w-10 rounded-full bg-primary text-white shadow-xl shadow-primary/20 border-none hover:scale-110 transition-transform">
                                        <ShoppingBag className="h-4 w-4" />
                                    </Button>
                                </div>
                             </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') return;
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') router.replace('/dashboard/seller');
      else if (role === 'admin') router.replace('/dashboard/admin');
      else if (role === 'reseller') router.replace('/dashboard/reseller');
      else router.replace('/buyer/dashboard');
    }
  }, [mounted, user, userProfile, isUserLoading, isProfileLoading, router]);

  if (!mounted || isUserLoading || (user && isProfileLoading)) {
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
            position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%',
            background: 'radial-gradient(ellipse at 30% 40%, hsla(24, 100%, 55%, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, hsla(320, 100%, 60%, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, hsla(200, 100%, 55%, 0.1) 0%, transparent 40%)'
          }}
        />
        <div className="absolute top-0 left-0 w-full h-full cyber-grid opacity-20" />
      </div>

      <LiveTicker />
      
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center pt-12 px-4">
        <div className="container max-w-6xl mx-auto text-center space-y-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl">
            <Sparkles className="h-3 w-3 text-primary animate-spin-slow" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 font-cyber">Social Commerce Disruption</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
            <h1 className="font-cyber text-6xl md:text-9xl font-black uppercase tracking-tighter leading-none">
              <span className="text-white">POST EARN</span>
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
            <p className="max-w-3xl mx-auto text-lg md:text-2xl text-neutral-400 font-medium leading-relaxed">
              Transform your authentic videos into a 24/7 revenue stream. 
              <span className="text-primary font-black italic ml-1">Join as a Founding Merchant and get 1,000 Free AI Points.</span>
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
            <Button size="lg" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm bg-primary hover:bg-primary/90 text-white shadow-xl group relative overflow-hidden" asChild>
              <Link href="/signup?role=seller">
                <span className="relative z-10 flex items-center gap-2">CLAIM YOUR 1000 PTS <ArrowRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" /></span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-xl group" asChild>
              <Link href="/buyer/dashboard">ENTER DISCOVERY <Eye className="ml-3 h-5 w-5 group-hover:scale-125 transition-transform" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <LiveMarketplaceDemo />

      <section className="py-24 px-4 overflow-hidden">
        <div className="container max-w-7xl mx-auto">
          <GlobalSignalHub />
        </div>
      </section>

      <footer className="py-20 border-t border-white/5 bg-black">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col items-center md:items-start gap-4">
                <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
                  <div className="h-10 w-auto bg-white/5 p-2 rounded-xl border border-white/10 flex items-center justify-center">
                    <span className="font-cyber font-black text-white text-lg tracking-tighter">GO<span className="text-primary">EARN</span></span>
                  </div>
                </Link>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-700">© 2026 THE FUTURE OF COMMERCE</p>
            </div>
            <div className="flex items-center gap-12 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                <Link href="/features" className="hover:text-primary transition-colors">Features</Link>
                <Link href="/how-it-works" className="hover:text-primary transition-colors">How it Works</Link>
                <Link href="/terms" className="hover:text-primary transition-colors">Protocol</Link>
                <Link href="/privacy" className="hover:text-primary transition-colors">Encryption</Link>
            </div>
          </div>
      </footer>
    </LandingLayout>
  );
}