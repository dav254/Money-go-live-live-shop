'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Activity, ShieldCheck, Zap, Rocket, Users, Play, Radio, Eye, Tag, Loader2, Target, Globe, Heart
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// High-velocity dynamic imports with hydration safety
const GlobalSignalHub = dynamic(() => import('@/components/home/global-signal-hub'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-black/20 rounded-[3rem] animate-pulse" />
});

const AdminVideoShowcase = dynamic(() => import('@/components/home/admin-video-showcase'), {
    ssr: false,
    loading: () => <div className="h-[600px] w-full bg-black/10 rounded-[3rem] animate-pulse" />
});

export default function HomePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !isUserLoading && !isProfileLoading && user && userProfile) {
      const role = userProfile.userRole || userProfile.role;
      const target = role === 'seller' ? '/dashboard/seller' : 
                     role === 'admin' ? '/dashboard/admin' : 
                     role === 'reseller' ? '/dashboard/reseller' : 
                     '/buyer/dashboard';
      router.replace(target);
    }
  }, [isMounted, user, userProfile, isUserLoading, isProfileLoading, router]);

  if (!isMounted || isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black">
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
      <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
        <div className="absolute inset-0 cyber-grid opacity-5" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,0,0.15),transparent_50%)]" />
      </div>

      {/* High-Velocity Hero */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="container max-w-5xl mx-auto text-center space-y-10 py-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl"
          >
            <Sparkles className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 font-cyber">The Commerce Protocol</span>
          </motion.div>

          <div className="space-y-4">
            <h1 className="font-cyber text-6xl md:text-9xl font-black uppercase tracking-tighter leading-none text-white">
              POST EARN
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-neutral-400 font-medium leading-relaxed px-4">
              The world's first high-velocity social commerce engine. Eliminate the trust gap with 4K video discovery and autonomous digital yield.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Button size="lg" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-600/30 group" asChild>
              <Link href="/signup?role=seller">
                START SELLING <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10 bg-white/5 hover:bg-white/10 text-white" asChild>
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
      <section className="py-24 relative overflow-hidden bg-black border-y border-white/5">
        <div className="container max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-10">
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase font-black tracking-widest px-4 py-1">Manifesto v1.0</Badge>
                        <h3 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter text-white leading-tight">
                            THE PROTOCOL OF
                            <br />
                            <span className="text-primary italic text-6xl md:text-7xl">DIGITAL YIELD</span>
                        </h3>
                        <p className="text-neutral-400 text-lg font-medium leading-relaxed border-l-2 border-primary/20 pl-6">
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
                            <div key={i} className="flex gap-6 p-6 rounded-[2.5rem] bg-white/5 border border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors shadow-lg">
                                    <role.icon className="h-6 w-6 text-primary group-hover:text-white" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-white uppercase tracking-widest text-sm">{role.title}</h4>
                                    <p className="text-xs text-neutral-500 font-bold uppercase tracking-tight leading-relaxed">{role.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative group">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-[120px] animate-pulse group-hover:bg-primary/20 transition-all" />
                    {isMounted && <GlobalSignalHub />}
                    
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/5 text-center">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">FOUNDING BONUS</p>
                            <p className="text-3xl font-black text-primary font-cyber">1,000</p>
                            <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mt-1">FREE AI POINTS</p>
                        </div>
                        <div className="p-6 rounded-3xl bg-neutral-900/50 border border-white/5 text-center">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">COMMISSION CAP</p>
                            <p className="text-3xl font-black text-white font-cyber">25%</p>
                            <p className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] mt-1">MAX YIELD</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Live Discovery Showcase */}
      <section className="py-24 bg-neutral-950 relative">
        <div className="container max-w-7xl mx-auto px-6 text-center">
            <div className="mb-16 space-y-4">
                <Badge className="bg-red-600 text-white font-black uppercase tracking-widest px-4 py-1 animate-pulse border-none">SIGNAL ACTIVE</Badge>
                <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">DISCOVER THE <span className="text-primary italic">PULSE</span></h2>
                <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Real-time marketplace feedback loop</p>
            </div>
            
            {isMounted && <AdminVideoShowcase />}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-[radial-gradient(circle_at_50%_100%,rgba(255,0,0,0.1),transparent_50%)]">
          <div className="container max-w-4xl mx-auto px-4 text-center space-y-10">
            <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">READY TO SYNC?</h2>
            <p className="text-neutral-500 font-black uppercase tracking-[0.4em] text-[10px]">Founding Seller slots now available • Secure your node</p>
            <div className="flex flex-wrap justify-center gap-6">
                 <Button asChild size="lg" className="h-20 px-16 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-red-600 hover:bg-red-700 shadow-2xl shadow-red-600/30">
                    <Link href="/signup">CREATE ACCOUNT</Link>
                 </Button>
            </div>
          </div>
      </section>

      <footer className="py-20 border-t border-white/5 bg-black">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center gap-10">
            <span className="font-cyber font-black text-white text-3xl tracking-tighter opacity-40">GO<span className="text-red-600">EARN</span></span>
            <div className="flex gap-8 opacity-30">
                <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest hover:text-primary">Terms</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest hover:text-primary">Privacy</Link>
                <Link href="/faq" className="text-[10px] font-black uppercase tracking-widest hover:text-primary">Support</Link>
            </div>
            <p className="text-[8px] font-black text-neutral-800 uppercase tracking-[0.4em]">© 2026 GO EARN COMMERCE PROTOCOL • ALL RIGHTS RESERVED</p>
          </div>
      </footer>
    </LandingLayout>
  );
}