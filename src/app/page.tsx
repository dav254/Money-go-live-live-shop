'use client';

import { useState } from "react";
import { 
  Play, Upload, ArrowRight, Sparkles, Rocket, Crown, Star, Video, Zap, 
  TrendingUp, Radio, Users, MessageCircle, Share2, CheckCircle, Send, 
  Clock, Heart, Package, Truck, RotateCcw, BarChart3, DollarSign, Eye, 
  ShoppingBag, Shield, Lock, CreditCard, User, Handshake, Menu, X, Facebook, 
  Twitter, Instagram, Youtube, Mail, Phone, Globe, Cpu, Layers, MapPin
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';

const HomePageContent = () => {

  const BackgroundEffects = () => (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: -1 }}>
      <div 
        className="animate-aurora"
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          opacity: 0.2,
          background: 'radial-gradient(ellipse at 30% 40%, hsla(270, 100%, 60%, 0.4) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, hsla(200, 100%, 55%, 0.3) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, hsla(55, 100%, 55%, 0.25) 0%, transparent 40%)'
        }}
      />
      <div className="animate-float-slow" style={{ position: 'absolute', top: '5rem', left: '2.5rem', width: '24rem', height: '24rem', borderRadius: '50%', filter: 'blur(48px)', opacity: 0.15, background: 'hsl(270, 100%, 60%)' }} />
      <div className="animate-float-slow" style={{ position: 'absolute', bottom: '5rem', right: '2.5rem', width: '31rem', height: '31rem', borderRadius: '50%', filter: 'blur(48px)', opacity: 0.1, background: 'hsl(200, 100%, 55%)', animationDelay: '3s' }} />
      <div className="animate-float-slow" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '44rem', height: '44rem', borderRadius: '50%', filter: 'blur(48px)', opacity: 0.08, background: 'hsl(55, 100%, 55%)', animationDelay: '6s' }} />
      <div className="cyber-grid" style={{ position: 'absolute', inset: 0, opacity: 0.1 }} />
    </div>
  );

  const Section = ({ children, className = "", id = "", style = {} }: { children: React.ReactNode; className?: string; id?: string; style?: React.CSSProperties }) => (
    <section id={id} className={className} style={{ position: 'relative', padding: '5rem 0', ...style }}>
      {children}
    </section>
  );
  
  const FeatureCard = ({ icon: Icon, title, description, gradient }: { icon: any; title: string; description: string; gradient: string }) => (
    <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '1rem', transition: 'all 0.5s ease', overflow: 'hidden', height: '100%' }}>
      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} className={gradient}>
        <Icon style={{ width: '1.75rem', height: '1.75rem', color: 'white' }} />
      </div>
      <h3 className="font-cyber" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>{description}</p>
    </div>
  );
  
  const stats = [
    { value: "50K+", label: "Active Sellers", icon: Users },
    { value: "1M+", label: "Products Sold", icon: ShoppingBag },
    { value: "0%", label: "Listing Fees", icon: Zap },
    { value: "24/7", label: "AI Support", icon: Cpu },
  ];

  const features = [
    { icon: Video, title: "Video-First Commerce", description: "Videos convert 10× more than images", gradient: "gradient-hero" },
    { icon: Radio, title: "Go Live & Sell", description: "Real-time engagement like TikTok", gradient: "gradient-hero" },
    { icon: Users, title: "Reseller Network", description: "Let others sell for you, pay on success", gradient: "gradient-hero" },
    { icon: MessageCircle, title: "Direct Chat", description: "Instant messaging with buyers", gradient: "gradient-hero" },
    { icon: Package, title: "Order Management", description: "Track everything in one dashboard", gradient: "gradient-hero" },
    { icon: BarChart3, title: "AI Analytics", description: "Smart insights to grow faster", gradient: "gradient-hero" },
    { icon: CreditCard, title: "Fast Payouts", description: "Get paid within 24-48 hours", gradient: "gradient-hero" },
    { icon: Shield, title: "Seller Protection", description: "Secure & trusted platform", gradient: "gradient-hero" },
  ];

  const roadmapSteps = [
    { icon: User, title: "Complete Your Shop Profile", description: "Add logo, banner & bio to build trust", gradient: "gradient-hero" },
    { icon: Upload, title: "Upload Your First Product", description: "Videos convert 10× more — use them", gradient: "gradient-hero" },
    { icon: DollarSign, title: "Set Stock & Pricing", description: "Simple, clean, no confusing fees", gradient: "gradient-hero" },
    { icon: Users, title: "Enable Reseller Program", description: "Let others promote for free", gradient: "gradient-hero" },
    { icon: Radio, title: "Go Live", description: "Sell faster with real-time engagement", gradient: "gradient-hero" },
    { icon: Share2, title: "Share Your Shop Link", description: "Post on WhatsApp, IG, TikTok", gradient: "gradient-hero" },
  ];

  return (
    <>
      <BackgroundEffects />
      <div style={{ paddingTop: '5rem' }}> {/* Add padding to account for fixed header */}
        <Section style={{ minHeight: 'calc(100vh - 5rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '0rem' }}>
          <div className="container" style={{ position: 'relative', zIndex: 10, padding: '0 1rem', textAlign: 'center' }}>
            <div className="glass-card-strong cyber-border animate-fade-in" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 500, marginBottom: '2rem' }}>
              <Sparkles style={{ width: '1rem', height: '1rem', color: 'hsl(55, 100%, 50%)' }} />
              <span className="font-cyber" style={{ letterSpacing: '0.05em' }}>THE FUTURE OF SOCIAL COMMERCE</span>
              <Globe className="animate-spin-slow" style={{ width: '1rem', height: '1rem', color: 'hsl(200, 100%, 55%)' }} />
            </div>

            <h1 className="font-cyber animate-slide-up" style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', fontWeight: 800, marginBottom: '1.5rem', lineHeight: 1.1 }}>
              Where Videos
              <br />
              <span className="text-gradient glow-text">Become Income</span>
            </h1>

            <p className="animate-slide-up" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', color: 'rgba(255,255,255,0.6)', maxWidth: '48rem', margin: '0 auto 2.5rem', animationDelay: '0.1s' }}>
              The <span style={{ color: 'hsl(200, 100%, 55%)', fontWeight: 600 }}>2025</span> platform for creators, hustlers, and entrepreneurs.
              <span className="text-gradient-cyber" style={{ display: 'block', marginTop: '0.5rem', fontWeight: 600 }}> GoEarn</span> transforms your content into real wealth.
            </p>

            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', marginBottom: '4rem', animationDelay: '0.2s' }}>
              <Link href="/signup?role=seller" className="btn-hero font-cyber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                <Upload style={{ width: '1.25rem', height: '1.25rem' }} />
                <span>Start Selling Now</span>
                <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
              </Link>
              <button className="btn-hero-outline cyber-border" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Play style={{ width: '1.25rem', height: '1.25rem', color: 'hsl(270, 100%, 65%)' }} />
                <span>Watch Demo</span>
              </button>
            </div>

            <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', maxWidth: '64rem', margin: '0 auto', animationDelay: '0.4s' }}>
              {stats.map((stat, index) => (
                <div key={index} className="glass-card-strong cyber-border" style={{ borderRadius: '1rem', padding: '1.5rem', transition: 'all 0.5s' }}>
                  <stat.icon style={{ width: '1.5rem', height: '1.5rem', color: 'rgba(168, 85, 247, 0.6)', marginBottom: '0.5rem' }} />
                  <div className="font-cyber text-gradient" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 700 }}>{stat.value}</div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
        
        <Section id="for-sellers" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05), hsl(240, 20%, 4%), rgba(59, 130, 246, 0.05))' }}>
          <div className="container" style={{ padding: '0 1rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', borderRadius: '9999px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', color: 'hsl(55, 100%, 50%)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '2rem' }}>
              <Crown style={{ width: '1rem', height: '1rem' }} />
              <span className="font-cyber" style={{ letterSpacing: '0.05em' }}>EXCLUSIVE EARLY ACCESS</span>
            </div>
            <h2 className="font-cyber" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
              Become a <span className="text-gradient">Founding Seller</span>
            </h2>
            <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', marginBottom: '3rem', maxWidth: '42rem', margin: '0 auto 3rem' }}>
              Your exclusive chance to grow with us from Day One. Build a brand that stands out.
              <span className="text-gradient-cyber" style={{ display: 'block', marginTop: '0.5rem', fontWeight: 600 }}>Join early. Be discovered early. Earn early.</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem', maxWidth: '56rem', margin: '0 auto 3rem' }}>
              {[
                { icon: Rocket, title: "Early Access", description: "Get featured before the crowd" },
                { icon: Star, title: "Priority Support", description: "Direct line to success team" },
                { icon: Crown, title: "Founding Badge", description: "Exclusive recognition forever" }
              ].map((benefit, index) => (
                <div key={index} className="glass-card-strong" style={{ padding: '2rem', borderRadius: '1.5rem', transition: 'all 0.5s', height: '100%' }}>
                  <div className="gradient-hero" style={{ width: '4rem', height: '4rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', marginLeft: 'auto', marginRight: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <benefit.icon style={{ width: '2rem', height: '2rem', color: 'white' }} />
                  </div>
                  <h3 className="font-cyber" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{benefit.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)' }}>{benefit.description}</p>
                </div>
              ))}
            </div>
             <Link href="/signup?role=seller" className="btn-gold font-cyber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              <Rocket style={{ width: '1.25rem', height: '1.25rem' }} />
              <span>Claim Your Founding Spot</span>
              <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
            </Link>
          </div>
        </Section>
        <Section id="features">
          <div className="container" style={{ padding: '0 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h2 className="font-cyber" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
                <span style={{ color: 'hsl(270, 100%, 65%)' }}>Upload</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 0.75rem' }}>•</span>
                <span style={{ color: 'hsl(200, 100%, 55%)' }}>Sell</span>
                <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 0.75rem' }}>•</span>
                <span style={{ color: 'hsl(55, 100%, 50%)' }}>Earn</span>
              </h2>
              <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', maxWidth: '42rem', margin: '0 auto' }}>
                Everything you need to build a thriving business in the <span className="text-gradient" style={{ fontWeight: 600 }}>future of commerce</span>.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', maxWidth: '80rem', margin: '0 auto' }}>
              {features.map((feature, index) => (
                <FeatureCard key={index} {...feature} />
              ))}
            </div>
          </div>
        </Section>
        <Section style={{ background: 'linear-gradient(to bottom, hsl(240, 20%, 4%), rgba(168, 85, 247, 0.05), hsl(240, 20%, 4%))' }}>
          <div className="container" style={{ padding: '0 1rem', textAlign: 'center' }}>
            <h2 className="font-cyber" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
              Why Sellers <span className="text-gradient">Love</span> GoEarn
            </h2>
            <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', maxWidth: '42rem', margin: '0 auto 4rem' }}>
              Your growth is our mission. We give you the tools — you bring the hustle.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem', maxWidth: '64rem', margin: '0 auto' }}>
              {[
                { icon: Star, value: "0%", label: "Listing Fees" },
                { icon: Upload, value: "∞", label: "Unlimited Uploads" },
                { icon: Video, value: "10×", label: "Video Conversion" },
                { icon: Users, value: "847+", label: "Active Resellers" },
              ].map((item, index) => (
                <div key={index} className="glass-card-strong" style={{ padding: '1.5rem', borderRadius: '1rem', transition: 'all 0.3s' }}>
                  <item.icon style={{ width: '2rem', height: '2rem', color: 'hsl(270, 100%, 65%)', marginBottom: '1rem', marginLeft: 'auto', marginRight: 'auto' }} />
                  <div className="font-cyber text-gradient" style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>{item.value}</div>
                  <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Section>
          <div className="container" style={{ padding: '0 1rem', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '9999px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', color: 'hsl(270, 100%, 65%)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              <Heart style={{ width: '1rem', height: '1rem' }} />
              <span className="font-cyber">OUR PROMISE</span>
            </div>

            <h2 className="font-cyber" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
              Built for <span className="text-gradient">Entrepreneurs Everywhere</span>
            </h2>

            <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', marginBottom: '3rem', maxWidth: '42rem', margin: '0 auto 3rem' }}>
              GoEarn was built for the real hustlers of the world. Your feedback shapes every update, every feature.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', maxWidth: '56rem', margin: '0 auto' }}>
              {[
                { icon: Users, title: "Community First", description: "Every feature built on seller feedback" },
                { icon: Handshake, title: "We Grow Together", description: "Your success is our success" },
                { icon: Heart, title: "We Win Together", description: "A platform for entrepreneurs, by entrepreneurs" }
              ].map((item, index) => (
                <div key={index} style={{ textAlign: 'center' }}>
                  <div className="gradient-hero" style={{ width: '5rem', height: '5rem', borderRadius: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 15px 40px rgba(0,0,0,0.4)' }}>
                    <item.icon style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />
                  </div>
                  <h3 className="font-cyber" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>{item.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.6)' }}>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Section id="how-it-works" style={{ background: 'linear-gradient(to bottom, hsl(240, 20%, 4%), rgba(59, 130, 246, 0.05), hsl(240, 20%, 4%))' }}>
          <div className="container" style={{ padding: '0 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h2 className="font-cyber" style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', fontWeight: 700, marginBottom: '1rem' }}>
                Roadmap to <span className="text-gradient">First Sales</span>
              </h2>
              <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.6)', maxWidth: '42rem', margin: '0 auto' }}>
                Follow these steps and start earning today.
              </p>
            </div>
            <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {roadmapSteps.map((step, index) => (
                  <div key={index} className="glass-card" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.5rem', borderRadius: '1rem', transition: 'all 0.3s' }}>
                    <div className="gradient-hero font-cyber" style={{ position: 'absolute', top: '-0.75rem', left: '-0.75rem', width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700 }}>
                      {index + 1}
                    </div>
                    <div className="gradient-hero" style={{ width: '4rem', height: '4rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                      <step.icon style={{ width: '2rem', height: '2rem', color: 'white' }} />
                    </div>
                    <h3 className="font-cyber" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{step.title}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
        <Section>
          <div className="container" style={{ padding: '0 1rem', textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '6rem', height: '6rem', marginBottom: '2.5rem' }}>
              <div className="gradient-hero animate-pulse-glow" style={{ position: 'absolute', inset: 0, borderRadius: '50%' }} />
              <div className="gradient-hero" style={{ position: 'relative', width: '5rem', height: '5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Rocket style={{ width: '2.5rem', height: '2.5rem', color: 'white' }} />
              </div>
              <div className="animate-spin-slow" style={{ position: 'absolute', inset: 0 }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '0.5rem', height: '0.5rem', background: 'hsl(200, 100%, 55%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '0.5rem', height: '0.5rem', background: 'hsl(174, 85%, 40%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '0.5rem', height: '0.5rem', background: 'hsl(270, 100%, 65%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: '0.5rem', height: '0.5rem', background: 'hsl(55, 100%, 50%)', borderRadius: '50%' }} />
              </div>
            </div>
            <h2 className="font-cyber" style={{ fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
              Ready to Grow With<br /><span className="text-gradient glow-text">GoEarn</span>?
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(255,255,255,0.6)', marginBottom: '3rem', maxWidth: '42rem', margin: '0 auto 3rem' }}>
              Join thousands of global entrepreneurs transforming their passion into profit.
              <span className="text-gradient-cyber" style={{ display: 'block', marginTop: '0.5rem', fontWeight: 600 }}>The future of commerce starts now.</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', marginBottom: '3rem' }}>
              <Link href="/signup?role=seller" className="btn-hero font-cyber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '24rem', textDecoration: 'none' }}>
                <Upload style={{ width: '1.25rem', height: '1.25rem' }} />
                <span>Upload Your First Product</span>
                <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
              </Link>
              <Link href="/dashboard/seller/settings" className="btn-hero-outline cyber-border font-cyber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: '100%', maxWidth: '24rem', textDecoration: 'none' }}>
                <User style={{ width: '1.25rem', height: '1.25rem', color: 'hsl(270, 100%, 65%)' }} />
                <span>Customize Your Shop</span>
              </Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem' }}>
              {[
                { text: "Free to Start", icon: Zap },
                { text: "No Hidden Fees", icon: Shield },
                { text: "24/7 AI Support", icon: Cpu },
                { text: "Secure Payments", icon: Lock }
              ].map((badge, index) => (
                <div key={index} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '9999px' }}>
                  <badge.icon style={{ width: '1rem', height: '1rem', color: 'hsl(55, 100%, 50%)' }} />
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
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
