'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Zap, 
  Radio, Globe, RadioTower, Bot, Eye, Loader2, 
  Shield, ZapIcon, PlayCircle, 
  Activity, ArrowUpRight, Play
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

// Heavy interactive components are deferred with light placeholders
const GlobalSignalHub = dynamic(() => import("@/components/home/global-signal-hub"), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full rounded-[3rem] bg-white/5 animate-pulse border border-white/5" />
});

const AdminVideoShowcase = dynamic(() => import("@/components/home/admin-video-showcase"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-black/20 animate-pulse" />
});

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
    <div className="w-full bg-red-600/10 border-y border-red-600/20 backdrop-blur-md h-10 flex items-center overflow-hidden">
      <div className="container max-w-7xl mx-auto flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-red-600 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-red-600 font-cyber">Signal Pulse</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.p 
              key={tickerIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[9px] font-bold text-white/70 uppercase tracking-tighter"
            >
              {activities[tickerIndex]}
            </motion.p>
          </AnimatePresence>
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
      const role = userProfile.userRole || userProfile.role;
      const target = role === 'seller' ? '/dashboard/seller' : 
                     role === 'admin' ? '/dashboard/admin' : 
                     role === 'reseller' ? '/dashboard/reseller' : 
                     '/buyer/dashboard';
      router.replace(target);
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

  if (!isMounted || isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black">
        <div className="relative">
            <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-red-600 relative z-10" />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-red-600/60">Initializing Signal</p>
      </div>
    );
  }

  return (
    <LandingLayout>
      <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
        <div className="absolute inset-0 cyber-grid opacity-10" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,0,0.15),transparent_50%)]" />
      </div>

      <LiveTicker />
      
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center pt-16 px-4">
        <div className="container max-w-6xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
            <Sparkles className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 font-cyber">Discovery Optimization v2.0</span>
          </div>

          <div className="space-y-4">
            <h1 className="font-cyber text-6xl md:text-8xl font-black uppercase tracking-tighter leading-tight">
              <span className="text-white">POST EARN</span>
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-neutral-400 font-medium leading-relaxed">
              Disrupting digital commerce with authentic motion. Join as a Seller and receive <span className="text-red-600 font-black italic underline">1,000 Free AI Points</span> to scale your presence.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20 group" asChild>
              <Link href="/signup?role=seller">
                GET STARTED <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10 bg-white/5 hover:bg-white/10 text-white" asChild>
                <Link href="/buyer/dashboard">EXPLORE FEED</Link>
            </Button>
          </div>
        </div>
      </section>

      <AdminVideoShowcase />

      <section className="py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <GlobalSignalHub />
        </div>
      </section>

      <section className="py-24 bg-neutral-900/30 border-y border-white/5">
          <div className="container max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                      { icon: Activity, title: "High-Traffic Ready", desc: "Our video CDN scales instantly during viral peaks." },
                      { icon: Shield, title: "Trust-Engine", desc: "Automated verification protects your brand integrity." },
                      { icon: ZapIcon, title: "Precision Reach", desc: "AI maps products to high-intent buyers." },
                  ].map((item, i) => (
                      <div key={i} className="p-8 rounded-[2rem] bg-neutral-950/50 border border-white/5 hover:border-red-600/30 transition-all text-center group">
                          <div className="h-12 w-12 rounded-xl bg-red-600/10 flex items-center justify-center mb-6 mx-auto group-hover:bg-red-600 transition-all">
                            <item.icon className="h-6 w-6 text-red-600 group-hover:text-white" />
                          </div>
                          <h4 className="font-black uppercase tracking-widest text-white text-xs mb-3">{item.title}</h4>
                          <p className="text-xs text-neutral-500 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      <footer className="py-12 border-t border-white/5 bg-black">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-cyber font-black text-white text-lg tracking-tighter">GO<span className="text-red-600">EARN</span></span>
            <div className="flex items-center gap-8">
                <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-red-600 transition-colors">Protocol</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-red-600 transition-colors">Encryption</Link>
            </div>
          </div>
      </footer>
    </LandingLayout>
  );
}
