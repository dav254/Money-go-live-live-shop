'use client';

import { useEffect } from "react";
import { 
  Upload, ArrowRight, Sparkles, Rocket, Crown, Star, Video, Zap, 
  Radio, Users, Globe, Cpu, Layers,
  RadioTower, Bot, Eye, Loader2, ShoppingBag, Shield, CreditCard 
} from "lucide-react";
import Link from "next/link";
import { LandingLayout } from '@/components/layout/landing-layout';
import { useUser, useUserProfile } from '@/firebase';
import { useRouter } from "next/navigation";

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
  
  const stats = [
    { value: "50K+", label: "Active Sellers", icon: Users },
    { value: "1M+", label: "Products Sold", icon: ShoppingBag },
    { value: "0%", label: "Listing Fees", icon: Zap },
    { value: "24/7", label: "AI Support", icon: Cpu },
  ];

  const features = [
    { icon: Video, title: "Video-First Commerce", description: "Engage buyers with authentic product videos, proven to increase conversion and trust.", gradient: "gradient-hero" },
    { icon: RadioTower, title: "Live Shopping", description: "Host real-time selling events, interact with customers, and drive sales through live engagement.", gradient: "gradient-hero" },
    { icon: Bot, title: "AI-Powered Toolkit", description: "Leverage AI for content generation, sales strategy, and video creation to stay ahead of the curve.", gradient: "gradient-hero" },
    { icon: Layers, title: "Seamless Platform", description: "Manage products, orders, and payouts from a single, intuitive dashboard designed for growth.", gradient: "gradient-hero" },
    { icon: Users, title: "Direct Communication", description: "Build relationships and answer questions instantly with built-in chat between buyers and sellers.", gradient: "gradient-hero" },
    { icon: CreditCard, title: "Fast & Secure Payouts", description: "Get your earnings quickly and securely through integrated payment and payout systems.", gradient: "gradient-hero" },
    { icon: Shield, title: "Trusted & Secure", description: "Built on a secure foundation with seller verification and fraud detection to protect everyone.", gradient: "gradient-hero" },
  ];

  return (
    <>
      <BackgroundEffects />
      <div style={{ paddingTop: '5rem' }}>
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
              <span className="text-gradient-cyber" style={{ display: 'block', marginTop: '0.5rem', fontWeight: 600 }}> GoEarnvid.shop</span> transforms your content into real wealth.
            </p>

            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', marginBottom: '4rem', animationDelay: '0.2s' }}>
              <Link href="/signup?role=seller" className="btn-hero font-cyber" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                <Upload style={{ width: '1.25rem', height: '1.25rem' }} />
                <span>Start Selling Now</span>
                <ArrowRight style={{ width: '1.25rem', height: '1.25rem' }} />
              </Link>
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
              Your exclusive chance to grow with us from Day One. Build a brand that stands out on <span className="font-bold text-white">GoEarnvid.shop</span>.
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
                Everything you need to build a thriving business in the <span className="text-gradient" style={{ fontWeight: 600 }}>future of commerce</span> at GoEarnvid.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', maxWidth: '80rem', margin: '0 auto' }}>
              {features.map((feature, index) => (
                 <div key={index} className="glass-card" style={{ padding: '1.5rem', borderRadius: '1rem', transition: 'all 0.5s ease', overflow: 'hidden', height: '100%' }}>
                  <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }} className={feature.gradient}>
                    <feature.icon style={{ width: '1.75rem', height: '1.75rem', color: 'white' }} />
                  </div>
                  <h3 className="font-cyber" style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{feature.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>{feature.description}</p>
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
