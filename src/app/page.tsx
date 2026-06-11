'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Activity, ShieldCheck, Zap, Rocket, Users, Play, Radio, Eye, Tag, Loader2, Target
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// High-velocity dynamic imports
const GlobalSignalHub = dynamic(() => import('@/components/home/global-signal-hub'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-black/20 rounded-[3rem] animate-pulse" />
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

      {/* Live discovery Showcase: The Pulse */}
      <section className="py-24 border-y border-white/5 bg-neutral-950/50">
        <div className="container max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row gap-12 items-end justify-between mb-16">
            <div className="text-left space-y-4">
              <Badge variant="outline" className="text-primary border-primary/20 uppercase font-black tracking-widest">Global Discovery Pipe</Badge>
              <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">LIVE<br/><span className="text-primary italic">MARKETPLACE</span></h2>
            </div>
            <p className="max-w-sm text-neutral-500 font-bold text-xs uppercase tracking-widest leading-relaxed border-l border-primary/20 pl-6">
              Sellers go live. Buyers discover value. Resellers amplify the signal. A three-sided ecosystem built for the speed of social media.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "CYBER-STREETWEAR X", price: "89.00", viewers: "1.2k", merchant: "VoltStyle", hint: "futuristic jacket" },
              { name: "CHRONO-PRO WATCH", price: "245.00", viewers: "840", merchant: "SiliconHub", hint: "luxury watch" },
              { name: "NEURAL HEADPHONES", price: "199.00", viewers: "2.1k", merchant: "SonicMax", hint: "studio headphones" },
              { name: "DESIGNER OPTICS V2", price: "120.00", viewers: "450", merchant: "OpticFlow", hint: "sunglasses" },
            ].map((item, i) => (
              <div key={i} className="group relative aspect-[9/16] rounded-[2.5rem] overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl transition-all hover:border-primary/40">
                <Image 
                  src={`https://picsum.photos/seed/${item.name}/600/1000`} 
                  alt={item.name} 
                  fill 
                  className="object-cover opacity-40 group-hover:opacity-60 transition-all duration-700 group-hover:scale-105"
                  data-ai-hint={item.hint}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <Badge className="bg-red-600 animate-pulse border-none font-black uppercase text-[8px] tracking-widest px-2 py-0.5">
                    <Radio className="h-2 w-2 mr-1" /> SIGNAL LIVE
                  </Badge>
                  <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10">
                    <Eye className="h-2 w-2 text-white" />
                    <span className="text-[8px] font-black text-white">{item.viewers}</span>
                  </div>
                </div>

                <div className="absolute bottom-6 left-6 right-6 z-10 space-y-3">
                   <div className="space-y-1">
                      <p className="text-[8px] font-black uppercase tracking-widest text-primary">MERCHANT: {item.merchant}</p>
                      <h4 className="text-white font-black uppercase text-lg tracking-tighter leading-none">{item.name}</h4>
                      <div className="flex items-center gap-1.5 pt-1">
                        <Tag className="h-3 w-3 text-primary fill-primary" />
                        <p className="text-xl font-black tracking-tighter text-white">USD ${item.price}</p>
                      </div>
                   </div>
                   <Button className="w-full h-10 rounded-xl font-black uppercase tracking-widest text-[9px] bg-white text-black hover:bg-neutral-200">
                     ENTER SHOW
                   </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Unique Description: The Architecture of Digital Yield */}
      <section className="py-24 relative overflow-hidden bg-black">
        <div className="container max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-10">
                    <div className="space-y-6">
                        <h3 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">
                            THE PROTOCOL OF
                            <br />
                            <span className="text-primary italic">DIGITAL YIELD</span>
                        </h3>
                        <p className="text-neutral-400 text-lg font-medium leading-relaxed">
                            GoEarn is a decentralized marketplace designed to remove friction from entrepreneurship. We provide the infrastructure; you provide the motion.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {[
                            { title: "For Sellers", desc: "Scale instantly with the AI Studio. Transform images into cinematic video showcases. founding sellers get 1,000 points to start their journey.", icon: Store },
                            { title: "For Resellers", desc: "The ultimate low-barrier business path. Share unique smart-links, drive sales from your social feed, and earn commissions automatically.", icon: Zap },
                            { title: "For Buyers", desc: "Experience 'What You See is What You Get.' 4K video discovery combined with verified logistics and secure escrow settlements.", icon: ShieldCheck }
                        ].map((role, i) => (
                            <div key={i} className="flex gap-6 p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors">
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

                <div className="relative">
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                    {isMounted && <GlobalSignalHub />}
                </div>
            </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 bg-[radial-gradient(circle_at_50%_100%,rgba(255,0,0,0.1),transparent_50%)]">
          <div className="container max-w-4xl mx-auto px-4 text-center space-y-10">
            <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter text-white">READY TO SYNC?</h2>
            <p className="text-neutral-500 font-black uppercase tracking-[0.4em] text-[10px]">Founding Seller slots now available</p>
            <div className="flex flex-wrap justify-center gap-4">
                 <Button asChild size="lg" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs">
                    <Link href="/signup">CREATE ACCOUNT</Link>
                 </Button>
            </div>
          </div>
      </section>

      <footer className="py-20 border-t border-white/5">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center gap-10 opacity-40">
            <span className="font-cyber font-black text-white text-3xl tracking-tighter">GO<span className="text-red-600">EARN</span></span>
            <p className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.4em]">© 2026 GO EARN COMMERCE PROTOCOL • ALL RIGHTS RESERVED</p>
          </div>
      </footer>
    </LandingLayout>
  );
}

// Minimal temporary helper
const Store = ({ className }: { className?: string }) => <Users className={className} />;
