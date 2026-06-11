'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Activity, Shield, ZapIcon, Loader2
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// High-velocity dynamic import for the 3D Globe to prevent SSR crashes
const GlobalSignalHub = dynamic(() => import('@/components/home/global-signal-hub'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full flex flex-col items-center justify-center bg-black/20 rounded-[3rem] border border-white/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/30">Calibrating Global Nodes...</p>
    </div>
  )
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
        <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-red-600/60">Calibrating Signal</p>
      </div>
    );
  }

  return (
    <LandingLayout>
      <div className="fixed inset-0 pointer-events-none -z-10 bg-black">
        <div className="absolute inset-0 cyber-grid opacity-5" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,0,0,0.15),transparent_50%)]" />
      </div>

      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4">
        <div className="container max-w-5xl mx-auto text-center space-y-10">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles className="h-3 w-3 text-red-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/80 font-cyber">Hyper-Velocity Marketplace</span>
          </div>

          <div className="space-y-6">
            <h1 className="font-cyber text-6xl md:text-8xl font-black uppercase tracking-tighter leading-tight animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <span className="text-white">POST EARN</span>
              <br />
              <span className="text-gradient glow-text">REPEAT</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-neutral-400 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000">
              The world's most performant video-first commerce protocol. Join as a Seller and receive <span className="text-red-600 font-black italic">1,000 Free AI Points</span> instantly.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <Button size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-600 hover:bg-red-700 text-white shadow-2xl shadow-red-600/30 group" asChild>
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

      {/* Global 3D Visual Section */}
      <section className="py-12 bg-black">
          <div className="container max-w-7xl mx-auto px-4">
              <GlobalSignalHub />
          </div>
      </section>

      <section className="py-24 bg-neutral-900/10 border-y border-white/5">
          <div className="container max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {[
                      { icon: Activity, title: "Viral Velocity", desc: "Low-latency video pipelines for high-conversion discovery." },
                      { icon: Shield, title: "Verified Nodes", desc: "Every merchant and transaction is secured by the protocol." },
                      { icon: ZapIcon, title: "Neural Sync", desc: "AI-driven mapping between products and local demand." },
                  ].map((item, i) => (
                      <div key={i} className="flex flex-col items-center text-center space-y-4">
                          <div className="h-12 w-12 rounded-xl bg-red-600/10 flex items-center justify-center mb-2">
                            <item.icon className="h-6 w-6 text-red-600" />
                          </div>
                          <h4 className="font-black uppercase tracking-widest text-white text-xs">{item.title}</h4>
                          <p className="text-xs text-neutral-500 font-medium leading-relaxed max-w-[240px]">{item.desc}</p>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      <footer className="py-16 bg-black">
          <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center gap-8">
            <span className="font-cyber font-black text-white text-2xl tracking-tighter">GO<span className="text-red-600">EARN</span></span>
            <div className="flex items-center gap-12">
                <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:text-red-600 transition-colors">Protocol</Link>
                <Link href="/privacy" className="text-[10px] font-black uppercase tracking-widest text-neutral-600 hover:text-red-600 transition-colors">Encryption</Link>
            </div>
          </div>
      </footer>
    </LandingLayout>
  );
}