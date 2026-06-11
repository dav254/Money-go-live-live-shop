'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Activity, ShieldCheck, Zap, Rocket, Radio, Eye, Tag, ShoppingBag, Loader2
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from "next/image";

// Interactive Globe loaded dynamically for client-side execution
const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-muted/10 rounded-3xl animate-pulse flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">Syncing 3D Signal...</div>
});

const DEMO_PRODUCTS = [
    { id: 1, name: 'Cyber-Streetwear V2', price: 42.00, viewers: 124, img: 'https://picsum.photos/seed/fashion/600/800' },
    { id: 2, name: 'Minimalist Tech Hub', price: 850.00, viewers: 89, img: 'https://picsum.photos/seed/tech/600/800' },
    { id: 3, name: 'Artisan Roast Coffee', price: 18.50, viewers: 42, img: 'https://picsum.photos/seed/coffee/600/800' },
    { id: 4, name: 'Performance Runner X', price: 120.00, viewers: 215, img: 'https://picsum.photos/seed/shoes/600/800' },
];

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

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 pt-12 overflow-hidden bg-background">
        <div className="container max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          
          <div className="text-left space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
            <Badge variant="secondary" className="px-4 py-1.5 rounded-full bg-primary/10 text-primary border-none font-bold uppercase tracking-widest text-[10px]">
              <Sparkles className="h-3 w-3 mr-2 inline" />
              Founding Seller Bonus: +1,000 AI Points
            </Badge>
            
            <h1 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-foreground">
              GO <span className="text-primary">EARN</span>
              <br />
              LIVE YIELD
            </h1>
            
            <p className="max-w-lg text-lg text-muted-foreground font-medium leading-relaxed">
              Disrupting the marketplace gap with high-fidelity video discovery. The architecture of digital yield is here. Post, earn, and repeat.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 group" asChild>
                <Link href="/signup?role=seller">
                  START SELLING <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs border-border" asChild>
                  <Link href="/buyer/dashboard">BROWSE MARKET</Link>
              </Button>
            </div>
          </div>

          <div className="relative h-[400px] md:h-[500px] w-full flex items-center justify-center">
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
                <p className="text-[10px] font-black uppercase tracking-widest">Global Discovery Protocol Active</p>
             </div>
          </div>
        </div>
      </section>

      {/* Live discovery Section */}
      <section className="py-24 bg-muted/30 border-y border-border">
        <div className="container max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-12">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-red-600 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live discovery Signal</span>
                    </div>
                    <h2 className="font-cyber text-3xl font-black uppercase tracking-tighter">TRENDING NOW</h2>
                </div>
                <Button variant="ghost" className="font-black uppercase tracking-widest text-[10px]" asChild>
                    <Link href="/buyer/dashboard">Explore All <ArrowRight className="ml-2 h-3 w-3" /></Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {DEMO_PRODUCTS.map((product) => (
                    <div key={product.id} className="group relative aspect-[3/4] rounded-[2rem] overflow-hidden bg-neutral-900 border border-border shadow-2xl hover:border-primary/50 transition-all duration-500">
                        <Image 
                            src={product.img} 
                            alt={product.name} 
                            fill 
                            className="object-cover opacity-60 group-hover:opacity-80 transition-all duration-700 group-hover:scale-110" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                        
                        <div className="absolute top-4 left-4">
                            <Badge className="bg-red-600 text-white border-none font-black uppercase tracking-widest text-[8px] animate-pulse">
                                LIVE
                            </Badge>
                        </div>

                        <div className="absolute bottom-6 left-6 right-6 space-y-2">
                            <h4 className="text-white font-black uppercase text-lg tracking-tighter leading-none">{product.name}</h4>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 text-primary">
                                    <Tag className="h-3.5 w-3.5 fill-current" />
                                    <span className="text-xl font-black tracking-tighter">USD ${product.price.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-50">
                                    <Eye className="h-3 w-3 text-white" />
                                    <span className="text-[10px] font-black text-white">{product.viewers}</span>
                                </div>
                            </div>
                            <Button className="w-full h-10 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] mt-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                <ShoppingBag className="mr-2 h-3 w-3" /> BUY INSTANT
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Protocol Description */}
      <section className="py-24 bg-background">
        <div className="container max-w-4xl mx-auto px-4 text-center space-y-12">
            <div className="space-y-4">
                <h2 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter">The Commerce Protocol</h2>
                <p className="text-muted-foreground text-lg font-medium leading-relaxed">
                    Go Earn is the first marketplace built for high-velocity engagement. We bridge the gap between social content and immediate yield, creating a recursive loop of value for everyone in the ecosystem.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                <div className="space-y-3 p-6 rounded-3xl bg-muted/50 border border-border">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <Rocket className="h-5 w-5" />
                    </div>
                    <h3 className="font-black uppercase tracking-tight">Sellers</h3>
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed uppercase tracking-wide">
                        Post 4K product videos and leverage AI to reach global buyers. No listing fees. Just results.
                    </p>
                </div>
                <div className="space-y-3 p-6 rounded-3xl bg-muted/50 border border-border">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <Zap className="h-5 w-5" />
                    </div>
                    <h3 className="font-black uppercase tracking-tight">Resellers</h3>
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed uppercase tracking-wide">
                        Scale your income without inventory. Share unique smart links and earn instant verified commissions.
                    </p>
                </div>
                <div className="space-y-3 p-6 rounded-3xl bg-muted/50 border border-border">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="font-black uppercase tracking-tight">Trust</h3>
                    <p className="text-xs text-muted-foreground font-bold leading-relaxed uppercase tracking-wide">
                        Escrow-protected payments and verified logistics ensure every transaction is secure and final.
                    </p>
                </div>
            </div>
        </div>
      </section>
    </LandingLayout>
  );
}
