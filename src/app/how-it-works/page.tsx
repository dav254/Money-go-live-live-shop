'use client';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Video, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  ShoppingBag, 
  BadgeCent,
  Users,
  LayoutGrid,
  Bot
} from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const sellerSteps = [
    {
      icon: Video,
      title: "Authentic Listing",
      description: "Upload real product videos. Buyers trust what they see in motion. No high-cost studio needed—just you and your product."
    },
    {
      icon: Bot,
      title: "AI Optimization",
      description: "Use your free AI points to generate viral captions, SEO-friendly descriptions, and high-converting marketing content instantly."
    },
    {
      icon: RadioTower,
      title: "Go Live & Engage",
      description: "Broadcast live shopping events. Answer questions in real-time, trigger flash deals, and build a community of loyal customers."
    },
    {
      icon: TrendingUp,
      title: "Scale via Resellers",
      description: "Activate our 'Sales Army'. Set your commission and let thousands of resellers promote your links to their private networks."
    }
  ];

  const buyerSteps = [
    {
      icon: ShoppingBag,
      title: "Discovery Feed",
      description: "Swipe through an immersive feed of real products. Discover unique items from verified local and global merchants."
    },
    {
      icon: ShieldCheck,
      title: "Zero-Filter Trust",
      description: "Shop with confidence. Video-first listings mean what you see is exactly what arrives at your doorstep."
    },
    {
      icon: Zap,
      title: "Secure Checkout",
      description: "Pay instantly with M-Pesa, PayPal, or Card. Your funds are protected until delivery is confirmed."
    }
  ];

  return (
    <LandingLayout>
      <div className="bg-black text-white py-24 px-4 overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/5 blur-[120px] rounded-full -z-10" />
        
        <div className="container max-w-6xl mx-auto space-y-32">
          {/* Header */}
          <div className="text-center space-y-6">
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10 uppercase font-black tracking-[0.3em] py-2 px-6 rounded-full text-[10px]">
              The Protocol
            </Badge>
            <h1 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none">
              How Go<span className="text-primary">Earn</span> Works
            </h1>
            <p className="text-neutral-500 font-bold uppercase tracking-widest text-sm max-w-2xl mx-auto">
              A autonomous ecosystem connecting creators, amplifiers, and shoppers through high-velocity video signals.
            </p>
          </div>

          {/* Seller Path */}
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <LayoutGrid className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-cyber text-3xl font-black uppercase text-white">The Merchant Path</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {sellerSteps.map((step, i) => (
                <Card key={i} className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all rounded-[2rem] p-4 group">
                  <CardHeader>
                    <div className="p-4 bg-black rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform">
                      <step.icon className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-lg font-black uppercase tracking-tighter text-white">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-400 font-medium leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Buyer Path */}
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <h2 className="font-cyber text-3xl font-black uppercase text-white">The Shopper Path</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {buyerSteps.map((step, i) => (
                <div key={i} className="relative p-8 rounded-[3rem] bg-neutral-900/30 border border-white/5 space-y-6">
                  <div className="absolute -top-4 -right-4 h-12 w-12 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center text-xs font-black text-neutral-500">
                    0{i+1}
                  </div>
                  <div className="p-4 bg-primary/10 rounded-2xl w-fit">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-white">{step.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed font-medium">{step.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Founding Seller Section */}
          <div className="bg-primary/10 border-2 border-primary/20 rounded-[4rem] p-8 md:p-16 relative overflow-hidden text-center">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full" />
             <div className="relative z-10 space-y-8">
                <Badge className="bg-primary text-white font-black uppercase tracking-[0.4em] px-6 py-2">Exclusive Incentive</Badge>
                <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase text-white leading-none">
                  JOIN AS A <br /> FOUNDING MERCHANT
                </h2>
                <p className="text-lg text-neutral-300 max-w-xl mx-auto font-medium">
                  Be among the first 1,000 sellers and receive <span className="text-primary font-black">1,000 Free AI Points</span> to boost your first video content.
                </p>
                <Button size="lg" className="h-20 px-12 rounded-[2rem] font-black uppercase tracking-widest text-sm bg-primary hover:bg-primary/90 text-white shadow-2xl" asChild>
                  <Link href="/signup?role=seller">CREATE MY SHOP NOW <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
             </div>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}

// Minimal local replacement for missing icon in this scope
const RadioTower = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/></svg>
);