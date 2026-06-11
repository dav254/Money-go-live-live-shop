'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Activity, ShieldCheck, Zap, Rocket, Users, Radio, Globe as GlobeIcon, Loader2
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Interactive Globe loaded dynamically for client-side execution to prevent 404/SSR errors
const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-muted/20 rounded-3xl animate-pulse" />
});

export default function HomePage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle Redirection logic without blocking the initial render
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

  return (
    <LandingLayout>
      {/* Hero Section - Light & Clean */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 pt-12 overflow-hidden bg-background">
        <div className="container max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          
          <div className="text-left space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
            <Badge variant="secondary" className="px-4 py-1.5 rounded-full bg-primary/10 text-primary border-none font-bold uppercase tracking-widest text-[10px]">
              <Sparkles className="h-3 w-3 mr-2 inline" />
              Founding Seller Bonus Active
            </Badge>
            
            <h1 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-foreground">
              GO <span className="text-primary">EARN</span>
              <br />
              NEXT-GEN SYNC
            </h1>
            
            <p className="max-w-lg text-lg text-muted-foreground font-medium leading-relaxed">
              The architecture of digital yield. Disrupting the marketplace gap with high-fidelity video discovery. Post, earn, and repeat at global scale.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 group" asChild>
                <Link href="/signup?role=seller">
                  START SELLING <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs border-border" asChild>
                  <Link href="/buyer/dashboard">EXPLORE FEED</Link>
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-4">
                <div className="flex flex-col">
                    <span className="text-2xl font-black font-cyber">1,000</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">FREE AI POINTS</span>
                </div>
                <div className="w-px h-10 bg-border" />
                <div className="flex flex-col">
                    <span className="text-2xl font-black font-cyber">24/7</span>
                    <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">LIVE SIGNAL</span>
                </div>
            </div>
          </div>

          <div className="relative h-[500px] w-full flex items-center justify-center">
             <div className="absolute inset-0 bg-primary/5 rounded-full blur-[120px] animate-pulse" />
             {isMounted && (
                <Globe
                    width={600}
                    height={600}
                    backgroundColor="rgba(0,0,0,0)"
                    globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
                    bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                    atmosphereColor="hsl(var(--primary))"
                    atmosphereAltitude={0.15}
                />
             )}
             <div className="absolute bottom-10 right-0 bg-background/80 backdrop-blur-md p-4 rounded-2xl border border-border shadow-2xl flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[10px] font-black uppercase tracking-widest">Global Nodes Active</p>
             </div>
          </div>
        </div>
      </section>

      {/* Protocol Section */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="container max-w-7xl mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
                <h2 className="font-cyber text-3xl font-black uppercase tracking-tighter">The Commerce Protocol</h2>
                <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Three nodes of value. One unified ecosystem.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { 
                        title: "Sell Direct", 
                        desc: "Upload 4K product videos and reach a global audience. No listing fees, just pure growth for original creators.", 
                        icon: Rocket,
                        color: "text-blue-500" 
                    },
                    { 
                        title: "Resell Network", 
                        desc: "Pick products you love, share unique smart links, and earn instant commissions on every verified sale.", 
                        icon: Zap,
                        color: "text-yellow-500"
                    },
                    { 
                        title: "Verified Trust", 
                        desc: "Escrow-protected payments and verified local logistics for a total security protocol on every transaction.", 
                        icon: ShieldCheck,
                        color: "text-green-500"
                    }
                ].map((item, i) => (
                    <div key={i} className="p-8 rounded-[2rem] bg-background border border-border shadow-sm hover:shadow-xl transition-all group">
                        <div className={cn("h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors", item.color)}>
                            <item.icon className="h-6 w-6" />
                        </div>
                        <h3 className="font-cyber text-xl font-bold uppercase tracking-tight mb-3">{item.title}</h3>
                        <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </section>
    </LandingLayout>
  );
}
