'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Rocket, Video, Zap, 
  Radio, Globe, RadioTower, Bot, Eye, Loader2, 
  Shield, CreditCard, Target, ZapIcon, PlayCircle, 
  BarChart3, Activity, ArrowUpRight, CheckCircle2
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
import GlobalSignalHub from "@/components/home/global-signal-hub";

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

const HomePageContent = () => {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      if (userProfile.status === 'suspended') return;

      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else if (role === 'reseller') {
        router.replace('/dashboard/reseller');
      } else {
        router.replace('/buyer/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

  if (isUserLoading || (user && isProfileLoading)) {
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
    <>
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
            <Button size="lg" variant="outline" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-xl group" asChild>
              <Link href="/buyer/dashboard">
                ENTER DISCOVERY <Eye className="ml-3 h-5 w-5 group-hover:scale-125 transition-transform" />
              </Link>
            </Button>
          </motion.div>
          
          {/* Real-time Performance HUD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-20 max-w-5xl mx-auto">
            {[
                { label: 'Signal Quality', value: '4K ULTRA', icon: RadioTower, color: 'text-blue-500', bg: 'bg-blue-500/5' },
                { label: 'Merchant Bonus', value: '+1000 PTS', icon: ZapIcon, color: 'text-yellow-500', bg: 'bg-yellow-500/5' },
                { label: 'Merchant Trust', value: 'VERIFIED', icon: Shield, color: 'text-green-500', bg: 'bg-green-500/5' },
                { label: 'Global Reach', value: 'UNLIMITED', icon: Globe, color: 'text-primary', bg: 'bg-primary/5' },
            ].map((stat, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + (i * 0.1) }}
                    className={cn("p-6 rounded-[2rem] border border-white/5 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all", stat.bg)}
                >
                    <stat.icon className={cn("h-5 w-5 mb-4 mx-auto", stat.color)} />
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-2">{stat.label}</p>
                    <p className="text-xl font-black font-cyber text-white tracking-tighter">{stat.value}</p>
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-150 transition-transform">
                        <stat.icon className="h-16 w-16" />
                    </div>
                </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3D Global Signal Hub Section */}
      <section className="py-24 px-4 overflow-hidden">
        <div className="container max-w-7xl mx-auto">
          <GlobalSignalHub />
        </div>
      </section>

      {/* Narrative Section: The Content Pipeline */}
      <section className="py-40 px-4 relative overflow-hidden">
        <div className="container max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                <div className="space-y-12">
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.3em] text-[10px] px-4 py-1.5 rounded-full">System Architecture</Badge>
                        <h2 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none text-white">
                            Engineered for 
                            <br />
                            <span className="text-gradient">Maximum Yield</span>
                        </h2>
                        <p className="text-neutral-400 text-xl leading-relaxed max-w-xl">
                            Static images don't sell. Authentic motion does. We've built a pipeline that removes friction from discovery to payout.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            { icon: PlayCircle, title: "Zero-Filter Policy", desc: "Show your products as they truly are. Build the deepest level of buyer trust." },
                            { icon: Bot, title: "AI-Augmented Logic", desc: "Our neural network optimizes your tags and descriptions for global SEO." },
                            { icon: CreditCard, title: "Hyper-Local Checkout", desc: "Integrated M-Pesa flows mean zero drop-offs at the payment stage." },
                        ].map((item, i) => (
                            <motion.div 
                                key={i}
                                whileHover={{ x: 10 }}
                                className="flex gap-6 p-8 rounded-[2.5rem] bg-neutral-900/40 border border-white/5 hover:border-primary/30 transition-all group"
                            >
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all">
                                    <item.icon className="h-7 w-7 text-primary group-hover:text-white transition-colors" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black uppercase tracking-tight text-white text-lg">{item.title}</h4>
                                    <p className="text-sm text-neutral-500 font-medium leading-relaxed">{item.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute -inset-10 bg-primary/10 blur-[120px] rounded-full opacity-50 animate-pulse" />
                    <div className="relative aspect-[4/5] rounded-[4rem] overflow-hidden border-2 border-white/10 shadow-[0_0_100px_rgba(255,107,0,0.1)] bg-neutral-900">
                        <img 
                            src="https://picsum.photos/seed/goearn-pro/800/1000" 
                            alt="GoEarn Pro View" 
                            className="w-full h-full object-cover opacity-50 transition-all duration-1000 group-hover:scale-105" 
                            data-ai-hint="high fashion urban photography"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                        
                        {/* Interactive UI Mockup Overlay */}
                        <div className="absolute bottom-8 left-8 right-8 p-10 rounded-[3rem] bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse">
                                        <Radio className="text-white h-7 w-7" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500 leading-none mb-1">Signal Live</p>
                                        <p className="font-cyber text-xl font-black text-white uppercase tracking-tighter">FLASH DEAL ACTIVE</p>
                                    </div>
                                </div>
                                <Badge className="bg-primary/20 text-primary border-primary/30 font-black uppercase text-[10px] px-3 py-1">540 VIEWERS</Badge>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                    <span>CONVERSION FLOW</span>
                                    <span className="text-white">92.4%</span>
                                </div>
                                <Progress value={92} className="h-2 bg-white/5" />
                                <div className="pt-4 flex gap-4">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                        <p className="text-[9px] font-black text-neutral-500 uppercase mb-1 tracking-widest">Revenue</p>
                                        <p className="font-black text-white font-cyber">$4,250</p>
                                    </div>
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                        <p className="text-[9px] font-black text-neutral-500 uppercase mb-1 tracking-widest">Growth</p>
                                        <p className="font-black text-green-500 font-cyber">+12%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Scale Section */}
      <section className="py-40 bg-neutral-950/50 border-y border-white/5">
          <div className="container max-w-7xl mx-auto px-4">
              <div className="text-center space-y-6 mb-24">
                  <h3 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">
                      Scalability is <span className="text-primary italic">Native</span>
                  </h3>
                  <p className="text-neutral-500 max-w-2xl mx-auto font-medium text-lg">
                      Whether you are selling one unique piece or managing a global inventory, our architecture handles the load.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                      { icon: Activity, title: "High-Traffic Ready", desc: "Our video CDN scales instantly during viral peaks and live events." },
                      { icon: Shield, title: "Trust-Engine", desc: "Automated verification and fraud detection protect your brand integrity." },
                      { icon: Target, title: "Precision Reach", desc: "AI maps your products to buyers who have already shown high intent." },
                  ].map((item, i) => (
                      <div key={i} className="p-10 rounded-[3rem] bg-neutral-900/30 border border-white/5 hover:border-primary/20 transition-all flex flex-col items-center text-center group">
                          <div className="h-16 w-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/10 transition-all">
                            <item.icon className="h-8 w-8 text-primary" />
                          </div>
                          <h4 className="font-black uppercase tracking-widest text-white mb-3">{item.title}</h4>
                          <p className="text-sm text-neutral-500 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                  ))}
              </div>
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

      {/* Cinematic Footer */}
      <footer className="py-20 border-t border-white/5 bg-black">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col items-center md:items-start gap-4">
                <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
                  <div className="h-10 w-auto bg-white/5 p-2 rounded-xl border border-white/10 flex items-center justify-center">
                    <span className="font-cyber font-black text-white text-lg tracking-tighter">GO<span className="text-primary">EARN</span></span>
                  </div>
                </Link>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-700">
                    © 2026 THE FUTURE OF COMMERCE • GLOBAL HUB
                </p>
            </div>
            <div className="flex items-center gap-12">
                <Link href="/features" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">Features</Link>
                <Link href="/faq" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">Intelligence</Link>
                <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">Protocol</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-primary transition-colors">Encryption</Link>
            </div>
          </div>
      </footer>
    </>
  );
};

export default function HomePage() {
  return (
    <LandingLayout>
      <HomePageContent />
    </LandingLayout>
  )
}
