'use client';

import { useEffect, useState } from "react";
import { 
  ArrowRight, Sparkles, Radio, Eye, Tag, ShoppingBag, Zap, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

// Optimized Dynamic Import for the Globe
const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => <div className="h-[400px] w-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest opacity-20">Syncing Global Signal...</div>
});

const DEMO_PRODUCTS = [
    { id: 1, name: 'Premium Streetwear X', price: 45.00, viewers: 124, img: 'https://picsum.photos/seed/fashion/600/800', hint: 'luxury streetwear' },
    { id: 2, name: 'Acoustic Studio Pro', price: 299.00, viewers: 89, img: 'https://picsum.photos/seed/audio/600/800', hint: 'studio headphones' },
    { id: 3, name: 'Organic Coffee Roast', price: 19.50, viewers: 42, img: 'https://picsum.photos/seed/coffee/600/800', hint: 'coffee beans' },
    { id: 4, name: 'Precision Timepiece', price: 850.00, viewers: 215, img: 'https://picsum.photos/seed/watch/600/800', hint: 'luxury watch' },
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
      <div className="bg-background text-foreground transition-colors duration-500">
        {/* Hero Section */}
        <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 overflow-hidden border-b border-border">
          <div className="container max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 py-12">
            
            <div className="text-left space-y-8 animate-in fade-in slide-in-from-left-4 duration-700">
              <Badge variant="secondary" className="px-4 py-1.5 rounded-full bg-primary/10 text-primary border-none font-bold uppercase tracking-widest text-[10px]">
                <Sparkles className="h-3 w-3 mr-2 inline" />
                FOUNDING SELLER BONUS: +1,000 AI POINTS
              </Badge>
              
              <h1 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9] text-foreground">
                POST. <span className="text-primary italic">EARN.</span>
                <br />
                REPEAT.
              </h1>
              
              <p className="max-w-lg text-lg text-muted-foreground font-medium leading-relaxed">
                The high-velocity commerce protocol. Scale your business with AI-powered video discovery and instant global reach.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 group" asChild>
                  <Link href="/signup?role=seller">
                    START SELLING <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs border-border" asChild>
                    <Link href="/buyer/dashboard">DISCOVER FEED</Link>
                </Button>
              </div>
            </div>

            <div className="relative h-[400px] md:h-[500px] w-full flex items-center justify-center">
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
                  <p className="text-[10px] font-black uppercase tracking-widest">SIGNAL STABLE</p>
               </div>
            </div>
          </div>
        </section>

        {/* Live Discovery Showcase */}
        <section className="py-24 bg-muted/30">
          <div className="container max-w-7xl mx-auto px-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                  <div className="space-y-1">
                      <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-red-600 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">LIVE MARKET SIGNAL</span>
                      </div>
                      <h2 className="font-cyber text-4xl font-black uppercase tracking-tighter">TRENDING DISCOVERY</h2>
                  </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {DEMO_PRODUCTS.map((product) => (
                      <div key={product.id} className="group relative aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-card border border-border shadow-2xl hover:border-primary/50 transition-all duration-500">
                          <Image 
                              src={product.img} 
                              alt={product.name} 
                              fill 
                              className="object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110" 
                              data-ai-hint={product.hint}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                          
                          <div className="absolute top-6 left-6">
                              <Badge className="bg-red-600 text-white border-none font-black uppercase tracking-widest text-[9px] animate-pulse px-3 py-1">
                                  LIVE
                              </Badge>
                          </div>

                          <div className="absolute bottom-8 left-8 right-8 space-y-2 text-left">
                              <h4 className="text-white font-black uppercase text-xl tracking-tighter leading-none">{product.name}</h4>
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-primary">
                                      <Tag className="h-4 w-4 fill-current opacity-70" />
                                      <span className="text-2xl font-black tracking-tighter">USD ${product.price.toFixed(2)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 opacity-80">
                                      <Eye className="h-3.5 w-3.5 text-white" />
                                      <span className="text-[10px] font-black text-white">{product.viewers}</span>
                                  </div>
                              </div>
                              <Button className="w-full h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-[10px] mt-4 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-xl">
                                  <ShoppingBag className="mr-2 h-4 w-4" /> VIEW PRODUCT
                              </Button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        </section>

        {/* Technical Protocol Overview */}
        <section className="py-24 bg-background">
          <div className="container max-w-5xl mx-auto px-4 text-center space-y-16">
              <div className="space-y-4">
                  <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter">THE PROTOCOL</h2>
                  <p className="text-muted-foreground text-xl font-medium leading-relaxed max-w-3xl mx-auto">
                      GoEarn is a high-velocity engine that turns social momentum into financial yield.
                  </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
                  <div className="space-y-4 p-8 rounded-[3rem] bg-muted/30 border border-border hover:border-primary/20 transition-all group">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Zap className="h-6 w-6" />
                      </div>
                      <h3 className="font-black text-lg uppercase tracking-tight">Velocity</h3>
                      <p className="text-[11px] text-muted-foreground font-bold leading-relaxed uppercase tracking-widest">
                          Automated discovery algorithms push your content to high-intent buyers instantly.
                      </p>
                  </div>
                  <div className="space-y-4 p-8 rounded-[3rem] bg-muted/30 border border-border hover:border-primary/20 transition-all group">
                      <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                          <ShieldCheck className="h-6 w-6" />
                      </div>
                      <h3 className="font-black text-lg uppercase tracking-tight">Trust</h3>
                      <p className="text-[11px] text-muted-foreground font-bold leading-relaxed uppercase tracking-widest">
                          Verified merchant nodes and secure payment rails ensure every transaction is safe.
                      </p>
                  </div>
                  <div className="space-y-4 p-8 rounded-[3rem] bg-muted/30 border border-border hover:border-primary/20 transition-all group">
                      <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                          <ShoppingBag className="h-6 w-6" />
                      </div>
                      <h3 className="font-black text-lg uppercase tracking-tight">Yield</h3>
                      <p className="text-[11px] text-muted-foreground font-bold leading-relaxed uppercase tracking-widest">
                          Resellers amplify your reach, earning verified commissions on every sale.
                      </p>
                  </div>
              </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}
