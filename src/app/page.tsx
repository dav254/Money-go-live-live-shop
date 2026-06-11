'use client';

import { useEffect, useState } from "react";
import { 
<<<<<<< HEAD
  ArrowRight, Sparkles, Activity, ShieldCheck, Zap, Rocket, Users, Play, Radio, Eye, Tag, Loader2, Target, Globe, Heart
=======
  ArrowRight, Sparkles, Rocket, Video, Zap, 
  Radio, Globe, RadioTower, Bot, Eye, Loader2, 
  Shield, CreditCard, Target, PlayCircle, 
  Activity, ArrowUpRight, CheckCircle2,
  Play, Tag, ShoppingBag, ShieldCheck, Users,
  Heart,
  Layers,
  ChevronRight,
  Monitor,
  Flame,
  Globe2
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
<<<<<<< HEAD
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
=======
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';
import placeholderData from '@/app/lib/placeholder-images.json';
import Image from 'next/image';

const GlobalSignalHub = dynamic(() => import("@/components/home/global-signal-hub"), { 
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-neutral-900/20 animate-pulse rounded-[3rem]" />
});

const LiveMarketplaceDemo = () => {
    const items = placeholderData?.demoItems || [];
    
    if (items.length === 0) return null;

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

const EcosystemShowcase = () => (
    <div className="py-24 border-t border-white/5 bg-neutral-950/20">
        <div className="container max-w-7xl mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <Badge variant="outline" className="text-primary border-primary/30 font-black uppercase text-[10px] px-5 py-1 rounded-full bg-primary/5">The Protocol of Yield</Badge>
                <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">THE ENGINE OF <span className="text-primary italic">WEALTH</span></h2>
                <p className="max-w-2xl mx-auto text-neutral-500 font-bold uppercase tracking-tight text-[11px] md:text-xs leading-relaxed border-l-2 border-primary/20 pl-6 text-left">GoEarn is a high-velocity network where every action—posting, sharing, or shopping—is optimized for financial yield. We have decommissioned traditional static storefronts in favor of a cinematic discovery experience.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="bg-neutral-900/50 border-white/5 p-8 rounded-[3rem] space-y-6 hover:border-primary/30 transition-all group">
                    <div className="h-16 w-16 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                        <Rocket className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">FOR SELLERS</h3>
                        <p className="text-sm text-neutral-400 font-medium leading-relaxed">Transform your inventory into viral visual assets. Our AI-driven discovery engine prioritizes authentic video content, bridging the gap between product storytelling and direct revenue. Receive instant, verified payouts directly to your wallet.</p>
                        <div className="space-y-2 pt-4">
                            {["Zero Listing Fees", "Neural Content Toolkit", "Live Studio Signals"].map(item => (
                                <div key={item} className="flex items-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest">
                                    <CheckCircle2 className="h-3 w-3" /> {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card className="bg-neutral-900/50 border-white/5 p-8 rounded-[3rem] space-y-6 hover:border-blue-500/30 transition-all group">
                    <div className="h-16 w-16 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                        <Users className="h-8 w-8 text-blue-500" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">FOR RESELLERS</h3>
                        <p className="text-sm text-neutral-400 font-medium leading-relaxed">Initialize a global side-hustle with zero inventory risk. Amplify the products you believe in by deploying smart tracking links across social platforms. Our automated ledger tracks every conversion, ensuring your commission clears instantly.</p>
                        <div className="space-y-2 pt-4">
                            {["Dynamic Commission Tiers", "Smart Referral Logic", "Infinite ROI Potential"].map(item => (
                                <div key={item} className="flex items-center gap-2 text-[9px] font-black text-blue-500 uppercase tracking-widest">
                                    <CheckCircle2 className="h-3 w-3" /> {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card className="bg-neutral-900/50 border-white/5 p-8 rounded-[3rem] space-y-6 hover:border-green-500/30 transition-all group">
                    <div className="h-16 w-16 rounded-3xl bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="h-8 w-8 text-green-500" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">FOR SHOPPERS</h3>
                        <p className="text-sm text-neutral-400 font-medium leading-relaxed">Stop guessing and start seeing. Experience a immersive marketplace where real merchants show real products in real-time. Every transaction is secured by our trust protocol, holding funds in escrow until the items are in your hands.</p>
                        <div className="space-y-2 pt-4">
                            {["Verified Merchant Hubs", "Escrow Payment Stack", "Live Signal Interaction"].map(item => (
                                <div key={item} className="flex items-center gap-2 text-[9px] font-black text-green-500 uppercase tracking-widest">
                                    <CheckCircle2 className="h-3 w-3" /> {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    </div>
);

const PlatformMechanics = () => (
    <div className="py-24 bg-black">
        <div className="container max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-8">
                    <div className="space-y-4">
                        <Badge className="bg-primary/10 text-primary border-primary/20 uppercase font-black tracking-widest text-[9px]">Deep Tech Protocol</Badge>
                        <h2 className="font-cyber text-3xl md:text-5xl font-black uppercase text-white leading-tight">
                            NEURAL COMMERCE <br />
                            <span className="text-primary italic">ORCHESTRATION</span>
                        </h2>
                        <p className="text-neutral-400 font-medium leading-relaxed">GoEarn is not just a website; it's a decentralized hub of commerce signals. We've built an autonomous pipeline that handles the heavy lifting of modern entrepreneurship. From AI content generation to borderless payment settlements, we orchestrate the entire value chain.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                            { icon: Monitor, title: "Cinematic Rendering", desc: "Our player optimizes 4K video delivery for instant conversion." },
                            { icon: Flame, title: "Velocity Logic", desc: "Flash deals are triggered by real-time viewer sentiment." },
                            { icon: Globe2, title: "Borderless Payouts", desc: "Instant settlement across M-Pesa, Bank, and Global Card rails." },
                            { icon: ShieldCheck, title: "Escrow 2.0", desc: "Proprietary trust-lock system ensures buyer/seller safety." }
                        ].map((m, i) => (
                            <div key={i} className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/5">
                                <m.icon className="h-5 w-5 text-primary" />
                                <h4 className="font-bold text-sm text-white uppercase tracking-tighter">{m.title}</h4>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase leading-tight">{m.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative aspect-square lg:aspect-auto lg:h-[600px] rounded-[4rem] overflow-hidden border border-white/10 shadow-2xl">
                    <Image 
                        src="https://picsum.photos/seed/tech-comm/1200/1200" 
                        alt="Mechanics" 
                        fill 
                        className="object-cover opacity-40"
                        data-ai-hint="futuristic technology server"
                    />
                    <div className="absolute inset-0 bg-gradient-to-tr from-black via-primary/5 to-transparent" />
                    <div className="absolute bottom-12 left-12 right-12 bg-black/60 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 space-y-2">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">SYSTEM STATUS</p>
                        <p className="text-xl font-black text-white uppercase tracking-tighter">GLOBAL SIGNAL OPTIMAL</p>
                        <p className="text-sm text-neutral-400 font-medium">99.9% Uptime on inter-continental commerce rails. Our infrastructure is engineered for the highest velocity in digital trade.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f

// High-velocity dynamic imports with hydration safety
const GlobalSignalHub = dynamic(() => import('@/components/home/global-signal-hub'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-muted/20 rounded-[3rem] animate-pulse" />
});

const AdminVideoShowcase = dynamic(() => import('@/components/home/admin-video-showcase'), {
    ssr: false,
    loading: () => <div className="h-[600px] w-full bg-muted/10 rounded-[3rem] animate-pulse" />
});

<<<<<<< HEAD
=======
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

>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
export default function HomePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
<<<<<<< HEAD
  }, []);

  useEffect(() => {
    if (isMounted && !isUserLoading && !isProfileLoading && user && userProfile) {
      const role = userProfile.userRole || userProfile.role;
      const target = role === 'seller' ? '/dashboard/seller' : 
                     role === 'admin' ? '/dashboard/admin' : 
                     role === 'reseller' ? '/dashboard/reseller' : 
                     '/buyer/dashboard';
      router.replace(target);
=======
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') return;
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') router.replace('/dashboard/seller');
      else if (role === 'admin') router.replace('/dashboard/admin');
      else router.replace('/buyer/dashboard');
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
    }
  }, [isMounted, user, userProfile, isUserLoading, isProfileLoading, router]);

  if (!isMounted || isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <div className="relative">
            <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-red-600 relative z-10" />
        </div>
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-red-600/60 font-cyber">Initializing Signal</p>
      </div>
    );
  }

  return (
    <LandingLayout>
<<<<<<< HEAD
      <div className="fixed inset-0 pointer-events-none -z-10 bg-background">
        <div className="absolute inset-0 cyber-grid opacity-[0.03] dark:opacity-5" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,0,0.1),transparent_50%)]" />
      </div>

      {/* High-Velocity Hero */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="container max-w-5xl mx-auto text-center space-y-10 py-16">
=======
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
      
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center pt-12 px-4">
        <div className="container max-w-6xl mx-auto text-center space-y-10">
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-muted/50 border border-border backdrop-blur-xl"
          >
            <Sparkles className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-foreground/80 font-cyber">The Commerce Protocol</span>
          </motion.div>

          <div className="space-y-4">
            <h1 className="font-cyber text-6xl md:text-9xl font-black uppercase tracking-tighter leading-none text-foreground">
              POST EARN
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
<<<<<<< HEAD
            <p className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground font-medium leading-relaxed px-4">
              The world's first high-velocity social commerce engine. Eliminate the trust gap with 4K video discovery and autonomous digital yield.
=======
            <p className="max-w-3xl mx-auto text-lg md:text-2xl text-neutral-400 font-medium leading-relaxed [text-wrap:balance]">
              Static shops are ghosts of the past. GoEarn is the <span className="text-white font-bold">Content Engine</span> that transforms your authentic videos into a 24/7 revenue stream. Our autonomous platform allows anyone to scale a brand with zero friction. 
              <span className="text-primary font-black italic ml-1 underline decoration-primary/30">Join as a Seller and get 1,000 Free AI Points.</span>
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button size="lg" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-600/30 group" asChild>
              <Link href="/signup?role=seller">
                START SELLING <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
<<<<<<< HEAD
            <Button size="lg" variant="outline" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs border-input bg-background hover:bg-accent" asChild>
                <Link href="/buyer/dashboard">WATCH LIVE FEED</Link>
            </Button>
          </div>

          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto opacity-50">
             {[
               { icon: Activity, label: "Signal Locked" },
               { icon: ShieldCheck, label: "Trust Verified" },
               { icon: Zap, label: "Instant Yield" },
               { icon: Rocket, label: "Global Launch" }
             ].map((item, i) => (
               <div key={i} className="flex flex-col items-center gap-2">
                 <item.icon className="h-4 w-4 text-primary" />
                 <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* Unique Description: The Architecture of Digital Yield */}
      <section className="py-24 relative overflow-hidden bg-background border-y border-border">
        <div className="container max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-10">
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase font-black tracking-widest px-4 py-1">Manifesto v1.0</Badge>
                        <h3 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter text-foreground leading-tight">
                            THE PROTOCOL OF
                            <br />
                            <span className="text-primary italic text-6xl md:text-7xl">DIGITAL YIELD</span>
                        </h3>
                        <p className="text-muted-foreground text-lg font-medium leading-relaxed border-l-2 border-primary/20 pl-6">
                            GoEarn is a decentralized commerce architecture designed to remove every friction point from modern entrepreneurship. We don't just host products; we broadcast opportunities. 
                            By merging cinematic video discovery with an autonomous reseller pipeline, we've built a bridge between creative motion and financial results.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {[
                            { title: "Sellers: The Creative Node", desc: "Scale your inventory through the AI Studio. Founding sellers receive 1,000 AI points to automate descriptions and generate viral captions instantly.", icon: Zap },
                            { title: "Resellers: The Signal Multiplier", desc: "The lowest barrier to entry in digital commerce. Share unique smart-links to your social circles and earn clear, instant commissions on every verified sale.", icon: Rocket },
                            { title: "Buyers: High-Fidelity Discovery", desc: "Experience the 'What You See is What You Get' standard. 4K video proof combined with verified local logistics and secure escrow settlements.", icon: ShieldCheck }
                        ].map((role, i) => (
                            <div key={i} className="flex gap-6 p-6 rounded-[2.5rem] bg-muted/30 border border-border hover:border-primary/20 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors shadow-lg">
                                    <role.icon className="h-6 w-6 text-primary group-hover:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-foreground uppercase tracking-widest text-sm">{role.title}</h4>
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tight leading-relaxed">{role.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-[120px] animate-pulse group-hover:bg-primary/20 transition-all" />
                    {isMounted && <GlobalSignalHub />}
                    
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-muted/50 border border-border text-center">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">FOUNDING BONUS</p>
                            <p className="text-3xl font-black text-primary font-cyber">1,000</p>
                            <p className="text-[8px] font-black text-foreground/40 uppercase tracking-[0.2em] mt-1">FREE AI POINTS</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-muted/50 border border-border text-center">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">COMMISSION CAP</p>
                            <p className="text-3xl font-black text-foreground font-cyber">25%</p>
                            <p className="text-[8px] font-black text-foreground/40 uppercase tracking-[0.2em] mt-1">MAX YIELD</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Live Discovery Showcase */}
      <section className="py-24 bg-background relative">
        <div className="container max-w-7xl mx-auto px-6 text-center">
            <div className="mb-16 space-y-4">
                <Badge className="bg-red-600 text-white font-black uppercase tracking-widest px-4 py-1 animate-pulse border-none">SIGNAL ACTIVE</Badge>
                <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-foreground">DISCOVER THE <span className="text-primary italic">PULSE</span></h2>
                <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">Real-time marketplace feedback loop</p>
            </div>
            
            {isMounted && <AdminVideoShowcase />}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-[radial-gradient(circle_at_50%_100%,rgba(255,0,0,0.05),transparent_50%)]">
          <div className="container max-w-4xl mx-auto px-4 text-center space-y-10">
            <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-foreground">READY TO SYNC?</h2>
            <p className="text-muted-foreground font-black uppercase tracking-[0.4em] text-[10px]">Founding Seller slots now available • Secure your node</p>
            <div className="flex flex-wrap justify-center gap-6">
                 <Button asChild size="lg" className="h-20 px-16 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-red-600 hover:bg-red-700 shadow-2xl shadow-red-600/30">
                    <Link href="/signup">CREATE ACCOUNT</Link>
                 </Button>
            </div>
          </div>
      </section>

      <footer className="py-20 border-t border-border bg-background">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center gap-10">
            <span className="font-cyber font-black text-foreground text-3xl tracking-tighter opacity-40">GO<span className="text-red-600">EARN</span></span>
            <div className="flex gap-8 opacity-30">
                <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest hover:text-primary">Terms</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest hover:text-primary">Privacy</Link>
                <Link href="/faq" className="text-[10px] font-black uppercase tracking-widest hover:text-primary">Support</Link>
            </div>
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.4em]">© 2026 GO EARN COMMERCE PROTOCOL • ALL RIGHTS RESERVED</p>
          </div>
      </footer>
=======
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

      <section className="py-24 px-4 border-y border-white/5 bg-neutral-950/30">
          <div className="container max-w-7xl mx-auto">
              <div className="flex items-end justify-between mb-12">
                  <div className="space-y-4 text-left">
                      <Badge variant="outline" className="text-primary border-primary/30 font-black uppercase text-[10px] px-4">LIVE DISCOVERY</Badge>
                      <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter text-white">READY FOR <span className="text-primary italic">YIELD</span></h2>
                  </div>
              </div>
              <LiveMarketplaceDemo />
          </div>
      </section>

      <EcosystemShowcase />
      
      <PlatformMechanics />

      <section className="py-24 px-4 overflow-hidden">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
              <h2 className="font-cyber text-3xl font-black uppercase tracking-tight text-white">Global Signal Distribution</h2>
              <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Real-time merchant nodes across the ecosystem</p>
          </div>
          <GlobalSignalHub />
        </div>
      </section>

      <section className="py-48 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
          <div className="container max-w-5xl mx-auto text-center space-y-16 relative z-10">
              <h3 className="font-cyber text-5xl md:text-8xl font-black uppercase tracking-tighter text-white leading-none">
                  JOIN THE <span className="text-primary italic">FLEET</span>
              </h3>
              <p className="text-neutral-400 max-w-2xl mx-auto font-medium text-xl leading-relaxed">
                  GoEarn is now accepting a limited number of <span className="text-white font-bold underline decoration-primary/50 underline-offset-8">Founding Merchants.</span> 
                  Receive priority discovery placement, zero processing fees for 90 days, and exclusive performance bonuses for life.
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
>>>>>>> 45b2b0785b45919afcab9603bff9d1afe191a49f
    </LandingLayout>
  );
}
