'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Activity, Shield, ZapIcon, Loader2, Play, TrendingUp, ShoppingBag, Eye, Radio
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Robust dynamic imports for high-velocity client-only execution
const GlobalSignalHub = dynamic(() => import('@/components/home/global-signal-hub'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-black/20 rounded-[3rem] animate-pulse" />
});

const AdminVideoShowcase = dynamic(() => import('@/components/home/admin-video-showcase'), {
  ssr: false,
  loading: () => <div className="h-[600px] w-full bg-black/20 rounded-[3rem] animate-pulse" />
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
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-red-600/60">Initializing Signal</p>
      </div>
    );
  }

  return (
    <LandingLayout>
      <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
        <div className="absolute inset-0 cyber-grid opacity-5" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,0,0.15),transparent_50%)]" />
      </div>

      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 overflow-hidden">
        <div className="container max-w-5xl mx-auto text-center space-y-10 py-16">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 font-cyber leading-none">High-Velocity Commerce Protocol</span>
          </div>

          <div className="space-y-4">
            <h1 className="font-cyber text-6xl md:text-9xl font-black uppercase tracking-tighter leading-none animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <span className="text-white">POST EARN</span>
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base md:text-lg text-neutral-400 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 px-4">
              Eliminate the trust gap with 4K video discovery. Sellers who join today receive <span className="text-red-600 font-black italic">1,000 Free AI Points</span> for viral content generation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <Button size="lg" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-600/30 group" asChild>
              <Link href="/signup?role=seller">
                START SELLING <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10 bg-white/5 hover:bg-white/10 text-white" asChild>
                <Link href="/buyer/dashboard">WATCH LIVE FEED</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Showcase - Hydration Safe */}
      {isMounted && (
        <section className="py-24 relative overflow-hidden">
            <div className="container max-w-7xl mx-auto px-4">
                <AdminVideoShowcase />
            </div>
        </section>
      )}

      {/* Commerce Mechanics */}
      <section className="py-24 bg-black border-y border-white/5">
        <div className="container max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
                { 
                    title: "SELLERS", 
                    desc: "Upload 4K video, set your price, and go live. We handle the discovery pipe and secured payments.",
                    icon: ShoppingBag 
                },
                { 
                    title: "RESELLERS", 
                    desc: "No inventory required. Share unique links and earn automated commissions on every verified sale.",
                    icon: TrendingUp 
                },
                { 
                    title: "BUYERS", 
                    desc: "Authentic, video-first shopping. What you see is exactly what you get. Fast, local fulfillment.",
                    icon: Radio 
                }
            ].map((item, i) => (
                <div key={i} className="space-y-4 text-left p-8 rounded-[2.5rem] bg-white/5 border border-white/5 hover:border-red-600/30 transition-all group">
                    <div className="p-3 bg-red-600/10 rounded-2xl w-fit group-hover:bg-red-600 transition-colors">
                        <item.icon className="h-6 w-6 text-red-600 group-hover:text-white" />
                    </div>
                    <h3 className="font-cyber font-black text-xl text-white">{item.title}</h3>
                    <p className="text-sm text-neutral-500 leading-relaxed font-medium">{item.desc}</p>
                </div>
            ))}
        </div>
      </section>

      {/* 3D Globe - Hydration Safe */}
      {isMounted && (
        <section className="py-24 bg-black min-h-[600px] flex items-center justify-center relative">
            <div className="container max-w-7xl mx-auto px-4">
                <GlobalSignalHub />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
        </section>
      )}

      <footer className="py-20 bg-black border-t border-white/5">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center gap-10">
            <span className="font-cyber font-black text-white text-3xl tracking-tighter">GO<span className="text-red-600">EARN</span></span>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
                <Link href="/terms" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 hover:text-red-600 transition-colors">Merchant Terms</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 hover:text-red-600 transition-colors">Privacy Protocol</Link>
                <Link href="/about" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 hover:text-red-600 transition-colors">Ecosystem</Link>
                <Link href="/faq" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 hover:text-red-600 transition-colors">Support Node</Link>
            </div>
            <p className="text-[8px] font-black text-neutral-800 uppercase tracking-[0.4em]">© 2026 GO EARN COMMERCE PROTOCOL • ALL RIGHTS RESERVED</p>
          </div>
      </footer>
    </LandingLayout>
  );
}
