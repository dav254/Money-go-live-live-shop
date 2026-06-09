'use client';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Video, 
  ShoppingBag, 
  CheckCircle2, 
  Rocket, 
  Users, 
  Wallet, 
  MessageSquare, 
  TrendingUp, 
  Sparkles,
  Zap,
  ShieldCheck,
  Globe
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const buyerSteps = [
  {
    icon: Video,
    title: "Discover via Motion",
    description: "Forget static images. Swipe through a high-energy video feed where you see products in real-world action before you buy."
  },
  {
    icon: MessageSquare,
    title: "Live Engagement",
    description: "Join live shopping events, ask questions in real-time chat, and grab exclusive 'Flash Deals' triggered by the host."
  },
  {
    icon: ShieldCheck,
    title: "Secure Checkout",
    description: "Pay with confidence using M-Pesa or Global Cards. Every order is tracked until it reaches your doorstep."
  }
];

const sellerSteps = [
  {
    icon: Rocket,
    title: "Upload & Launch",
    description: "Create your shop and upload short-form videos. Our AI automatically optimizes your tags and descriptions for discovery."
  },
  {
    icon: Users,
    title: "Deploy Resellers",
    description: "Set a commission rate and let an army of resellers promote your products across WhatsApp and TikTok for you."
  },
  {
    icon: Wallet,
    title: "Automated Payouts",
    description: "Orders are verified and earnings are sent directly to your digital wallet. Withdraw to your bank or mobile money instantly."
  }
];

export default function HowItWorksPage() {
  return (
    <LandingLayout>
      <div className="bg-black text-white pb-24">
        {/* Hero Section */}
        <section className="relative py-24 px-4 overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full opacity-30 translate-y-[-50%]" />
          <div className="container max-w-4xl mx-auto text-center space-y-6 relative z-10">
            <h1 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none">
              The Protocol of <span className="text-primary italic">Yield</span>
            </h1>
            <p className="text-neutral-400 text-lg md:text-xl font-medium max-w-2xl mx-auto">
              GoEarn is a three-sided marketplace where creators, amplifiers, and shoppers thrive in a video-first ecosystem.
            </p>
          </div>
        </section>

        {/* For Buyers Section */}
        <section className="py-24 px-4">
          <div className="container max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-12 mb-16">
              <div className="flex-1 space-y-4">
                <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 font-black px-4">FOR SHOPPERS</Badge>
                <h2 className="font-cyber text-4xl font-black uppercase tracking-tight">Shopping Re-imagined</h2>
                <p className="text-neutral-400">Authentic discovery. Real-time trust. Seamless delivery.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {buyerSteps.map((step, i) => (
                <Card key={i} className="bg-neutral-900/50 border-white/5 hover:border-blue-500/30 transition-all p-4 rounded-[2.5rem]">
                  <CardHeader>
                    <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
                      <step.icon className="h-7 w-7 text-blue-500" />
                    </div>
                    <CardTitle className="font-black uppercase tracking-tight text-white">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-500 leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* For Sellers Section */}
        <section className="py-24 px-4 bg-white/5 border-y border-white/5">
          <div className="container max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 mb-16">
              <div className="flex-1 space-y-4 text-left md:text-right">
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 font-black px-4">FOR MERCHANTS</Badge>
                <h2 className="font-cyber text-4xl font-black uppercase tracking-tight">The Merchant Engine</h2>
                <p className="text-neutral-400">Transform your inventory into high-velocity viral content.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {sellerSteps.map((step, i) => (
                <Card key={i} className="bg-neutral-900/50 border-white/5 hover:border-primary/30 transition-all p-4 rounded-[2.5rem]">
                  <CardHeader>
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="font-black uppercase tracking-tight text-white">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-neutral-500 leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Global ROI Section */}
        <section className="py-24 px-4">
          <div className="container max-w-4xl mx-auto text-center space-y-12">
            <h3 className="font-cyber text-3xl font-black uppercase tracking-tight">Built for Global Scale</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              <div className="p-8 rounded-[3rem] bg-neutral-900 border border-white/5 space-y-4">
                <div className="flex items-center gap-3 text-green-500">
                  <CheckCircle2 className="h-5 w-5" />
                  <h4 className="font-black uppercase text-sm tracking-widest">Trust Protocol</h4>
                </div>
                <p className="text-sm text-neutral-500 font-medium">Every seller is verified. Every payment is held in escrow until delivery is confirmed. We eliminate the 'What I Ordered vs What I Got' risk.</p>
              </div>
              <div className="p-8 rounded-[3rem] bg-neutral-900 border border-white/5 space-y-4">
                <div className="flex items-center gap-3 text-purple-500">
                  <Sparkles className="h-5 w-5" />
                  <h4 className="font-black uppercase text-sm tracking-widest">AI Optimization</h4>
                </div>
                <p className="text-sm text-neutral-500 font-medium">Use our neural toolkit to generate descriptions, scripts, and social captions that are engineered to convert viewers into paying customers.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-4">
          <div className="container max-w-4xl mx-auto text-center space-y-8 bg-primary/10 border border-primary/20 p-12 rounded-[4rem] shadow-2xl">
            <h2 className="font-cyber text-4xl font-black uppercase tracking-tight">Ready to Initialize?</h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs" asChild>
                <Link href="/signup?role=seller">BECOME A SELLER</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10" asChild>
                <Link href="/signup?role=buyer">START SHOPPING</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </LandingLayout>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: any, className?: string }) {
  return (
    <div className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      variant === 'outline' ? "text-foreground" : "bg-primary text-primary-foreground",
      className
    )}>
      {children}
    </div>
  );
}
