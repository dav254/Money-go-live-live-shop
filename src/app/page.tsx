'use client';

import { useEffect } from "react";
import { 
  Upload, ArrowRight, Sparkles, Rocket, Crown, Star, Video, Zap, 
  Radio, Users, Globe, Cpu, Layers,
  RadioTower, Bot, Eye, Loader2, ShoppingBag, Shield, CreditCard,
  Target, ZapIcon, PlayCircle, BarChart3
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const HomePageContent = () => {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile) {
      const role = userProfile.userRole || userProfile.role;
      if (role === 'seller') {
        router.replace('/dashboard/seller');
      } else if (role === 'admin') {
        router.replace('/dashboard/admin');
      } else {
        router.replace('/buyer/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, isProfileLoading, router]);

  if (isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const BackgroundEffects = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 bg-black">
      <div 
        className="animate-aurora opacity-30"
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
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent" />
    </div>
  );

  return (
    <>
      <BackgroundEffects />
      
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20 px-4">
        <div className="container max-w-6xl mx-auto text-center space-y-8">
          
          <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-xl shadow-[0_0_30px_rgba(255,107,0,0.1)]">
            <Radio className="h-3 w-3 text-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary font-cyber">Live Signal Active</span>
          </div>

          <h1 className="font-cyber text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none animate-slide-up">
            The 4K Content
            <br />
            <span className="text-gradient glow-text">Economy</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-neutral-400 font-medium leading-relaxed animate-slide-up [animation-delay:200ms]">
            GoEarn is the command center for the next generation of entrepreneurs. 
            Transform your authentic videos into a global revenue stream with 
            <span className="text-white font-bold"> AI-powered growth</span> and <span className="text-white font-bold">instant local payouts.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up [animation-delay:400ms]">
            <Button size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-sm bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 group" asChild>
              <Link href="/signup?role=seller">
                Start Selling Now <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-sm border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-xl" asChild>
              <Link href="/buyer/dashboard">Browse Live Feed</Link>
            </Button>
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-16 max-w-4xl mx-auto animate-fade-in [animation-delay:600ms]">
            {[
                { label: 'Active Signal', value: 'Live', icon: RadioTower, color: 'text-red-500' },
                { label: 'Listing Fees', value: '0%', icon: ZapIcon, color: 'text-yellow-500' },
                { label: 'Trust Factor', value: 'Verified', icon: Shield, color: 'text-blue-500' },
                { label: 'Payout Speed', value: 'Instant', icon: Rocket, color: 'text-green-500' },
            ].map((stat, i) => (
                <div key={i} className="p-4 rounded-2xl bg-neutral-900/50 border border-white/5 backdrop-blur-md">
                    <stat.icon className={cn("h-4 w-4 mb-2 mx-auto", stat.color)} />
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">{stat.label}</p>
                    <p className="text-xl font-black font-cyber text-white">{stat.value}</p>
                </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="container max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-8">
                    <div className="space-y-4">
                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase font-black tracking-widest text-[10px] px-3 py-1">Sell Smarter</Badge>
                        <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white">
                            Engineered for
                            <br />
                            <span className="text-primary">Conversion</span>
                        </h2>
                    </div>
                    <p className="text-neutral-400 text-lg leading-relaxed">
                        The era of static images is over. GoEarn puts video at the heart of every interaction, building deep trust between sellers and buyers that a photo simply can't match.
                    </p>
                    
                    <div className="grid grid-cols-1 gap-6">
                        {[
                            { icon: PlayCircle, title: "Authentic Video Feed", desc: "No filters, no fakes. Real products shown by real people." },
                            { icon: BarChart3, title: "AI-Driven Insights", desc: "Our models predict what buyers want before they even search." },
                            { icon: CreditCard, title: "M-Pesa Integrated", desc: "Accept payments and withdraw funds with zero friction." },
                        ].map((item, i) => (
                            <div key={i} className="flex gap-4 p-6 rounded-3xl bg-neutral-900/30 border border-white/5 hover:border-primary/20 transition-all group">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 group-hover:scale-110 transition-transform">
                                    <item.icon className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-black uppercase tracking-tight text-white">{item.title}</h4>
                                    <p className="text-sm text-neutral-500 font-medium mt-1">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-30 animate-pulse" />
                    <div className="relative aspect-[4/5] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl bg-neutral-900">
                        <img 
                            src="https://picsum.photos/seed/goearn-hero/800/1000" 
                            alt="GoEarn Interface" 
                            className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700" 
                            data-ai-hint="luxury lifestyle fashion"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute bottom-10 left-10 right-10 p-8 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center animate-pulse">
                                    <Video className="text-white h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Live Show</p>
                                    <p className="font-cyber text-lg font-bold text-white uppercase">Flash Sale Active</p>
                                </div>
                            </div>
                            <Progress value={85} className="h-1.5 bg-white/10" />
                            <p className="mt-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Global Discovery Pool: 98% Synchronized</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4">
          <div className="container max-w-4xl mx-auto text-center space-y-12">
              <h3 className="font-cyber text-3xl md:text-5xl font-black uppercase tracking-tighter text-white">
                  Join the Founding
                  <br />
                  <span className="text-primary italic">Merchant Fleet</span>
              </h3>
              <p className="text-neutral-400 max-w-xl mx-auto font-medium">
                  Early adopters receive priority placement in the discovery feed and exclusive low-commission periods. Secure your spot today.
              </p>
              <div className="flex justify-center">
                <Button size="lg" className="h-20 px-16 rounded-[2rem] font-black uppercase tracking-[0.2em] text-lg bg-white text-black hover:bg-neutral-200 shadow-[0_0_50px_rgba(255,255,255,0.15)] transition-all active:scale-95" asChild>
                    <Link href="/signup?role=seller">Enter the Marketplace</Link>
                </Button>
              </div>
          </div>
      </section>

      {/* Simple Footer Text */}
      <footer className="py-12 border-t border-white/5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-700">
              © 2026 GOEARN • THE FUTURE OF COMMERCE • ALL RIGHTS RESERVED
          </p>
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
