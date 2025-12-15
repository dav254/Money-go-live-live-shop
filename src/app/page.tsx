
'use client';
import { useState } from "react";
import { 
  Play, Upload, ArrowRight, Sparkles, Rocket, Crown, Star, Video, Image as ImageIcon, Zap, 
  TrendingUp, Radio, Users, MessageCircle, Share2, CheckCircle, Send, 
  Clock, Heart, Package, Truck, MapPin, BarChart3, DollarSign, Eye, 
  ShoppingBag, Shield, Lock, CreditCard, User, Handshake, Menu, X, Facebook, 
  Twitter, Instagram, Youtube, Mail, Phone
} from "lucide-react";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

// ===== INLINE STYLES & DESIGN TOKENS =====
const colors = {
  primary: "rgb(45, 180, 160)",
  primaryDark: "rgb(35, 140, 125)",
  secondary: "rgb(230, 110, 80)",
  gold: "rgb(235, 185, 55)",
  neonGreen: "rgb(50, 205, 130)",
  neonPink: "rgb(235, 90, 140)",
  accent: "rgb(155, 90, 210)",
  dark: "rgb(12, 14, 20)",
  darkCard: "rgb(18, 22, 30)",
  muted: "rgb(35, 40, 55)",
  mutedForeground: "rgb(130, 140, 160)",
  foreground: "rgb(240, 240, 245)",
  border: "rgba(255, 255, 255, 0.1)",
};

const gradients = {
  hero: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 50%, ${colors.gold} 100%)`,
  primary: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
  secondary: `linear-gradient(135deg, ${colors.secondary} 0%, rgb(200, 90, 60) 100%)`,
  gold: `linear-gradient(135deg, ${colors.gold} 0%, rgb(200, 150, 40) 100%)`,
  accent: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.neonPink} 100%)`,
  neonPink: `linear-gradient(135deg, ${colors.neonPink} 0%, rgb(200, 70, 120) 100%)`,
  neonGreen: `linear-gradient(135deg, ${colors.neonGreen} 0%, rgb(40, 170, 100) 100%)`,
};

// ===== REUSABLE BUTTON COMPONENT =====
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "hero" | "heroOutline" | "gold" | "neon" | "secondary" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "xl";
  children: React.ReactNode;
}

const Button = ({ variant = "default", size = "default", children, className = "", style, ...props }: ButtonProps) => {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    whiteSpace: "nowrap",
    borderRadius: "0.75rem",
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: "all 0.3s ease",
    cursor: "pointer",
    border: "none",
    outline: "none",
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { height: "2.25rem", padding: "0 0.75rem", fontSize: "0.875rem" },
    default: { height: "2.5rem", padding: "0 1rem", fontSize: "0.875rem" },
    lg: { height: "3rem", padding: "0 1.5rem", fontSize: "1rem" },
    xl: { height: "3.5rem", padding: "0 2rem", fontSize: "1.125rem", borderRadius: "1rem" },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    hero: { background: gradients.hero, color: colors.dark, boxShadow: `0 10px 40px ${colors.primary}40` },
    heroOutline: { background: "transparent", border: `2px solid ${colors.primary}60`, color: colors.foreground },
    gold: { background: gradients.gold, color: colors.dark, boxShadow: `0 10px 40px ${colors.gold}40` },
    neon: { background: colors.neonPink, color: colors.foreground, boxShadow: `0 10px 40px ${colors.neonPink}40` },
    secondary: { background: gradients.secondary, color: colors.dark, boxShadow: `0 10px 40px ${colors.secondary}40` },
    ghost: { background: "transparent", color: colors.mutedForeground },
    default: { background: colors.primary, color: colors.dark, boxShadow: `0 10px 40px ${colors.primary}30` },
  };

  return (
    <button
      style={{ ...baseStyles, ...sizeStyles[size], ...variantStyles[variant], ...style }}
      className={`hover:scale-105 hover:opacity-90 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// ===== GLASS CARD COMPONENT =====
const GlassCard = ({ children, className = "", style, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    style={{
      background: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: `1px solid ${colors.border}`,
      ...style,
    }}
    className={className}
    {...props}
  >
    {children}
  </div>
);

// ===== ANIMATED ORB COMPONENT =====
const AnimatedOrb = ({ color, size, top, left, right, bottom, delay = 0 }: { color: string; size: string; top?: string; left?: string; right?: string; bottom?: string; delay?: number }) => (
  <div
    style={{
      position: "absolute",
      width: size,
      height: size,
      background: color,
      borderRadius: "50%",
      filter: "blur(100px)",
      top, left, right, bottom,
      animation: `float 6s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  />
);

// ===== MAIN INDEX COMPONENT =====
const Index = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Inject keyframes into document
  if (typeof document !== "undefined" && !document.getElementById("goearn-styles")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "goearn-styles";
    styleSheet.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
      
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(2deg); }
      }
      
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 20px ${colors.primary}66; }
        50% { box-shadow: 0 0 40px ${colors.primary}99, 0 0 60px ${colors.primary}4d; }
      }
      
      @keyframes bounce-subtle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes fade-in {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes slide-up {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
      .animate-bounce-subtle { animation: bounce-subtle 2s ease-in-out infinite; }
      .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
      .animate-slide-up { animation: slide-up 0.6s ease-out forwards; }
      
      .hover-scale:hover { transform: scale(1.05); }
      .transition-all { transition: all 0.3s ease; }
      
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Plus Jakarta Sans', sans-serif; background: ${colors.dark}; color: ${colors.foreground}; }
      h1, h2, h3, h4, h5, h6 { font-family: 'Space Grotesk', sans-serif; }
      
      .text-gradient {
        background: ${gradients.hero};
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      
      .gradient-bar {
        height: 2px;
        background: linear-gradient(90deg, ${colors.primary}, ${colors.secondary}, ${colors.gold});
      }
      
      .md-hidden { display: none; }
      @media (max-width: 768px) {
        .md-flex { display: none; }
        .md-hidden { display: block; }
      }
    `;
    document.head.appendChild(styleSheet);
  }

  // Common section styles
  const sectionStyle: React.CSSProperties = {
    padding: "5rem 1rem",
    position: "relative",
    overflow: "hidden",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "0 1rem",
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    lineHeight: 1.1,
  };

  return (
    <main style={{ minHeight: "100vh", overflowX: "hidden", background: colors.dark }}>
      {/* ===== NAVBAR ===== */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: `${colors.dark}cc`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: `1px solid ${colors.border}`,
      }}>
        <div style={{ ...containerStyle, display: "flex", alignItems: "center", justifyContent: "space-between", height: "4.5rem" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "2.75rem",
              height: "2.75rem",
              borderRadius: "0.75rem",
              background: gradients.hero,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 30px ${colors.primary}40`,
            }}>
              <span style={{ color: colors.dark, fontWeight: 700, fontSize: "1.5rem", fontFamily: "'Space Grotesk', sans-serif" }}>G</span>
            </div>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: colors.foreground, fontFamily: "'Space Grotesk', sans-serif" }}>Go Earn</span>
          </div>

          {/* Desktop Navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }} className="md-flex">
            {["Features", "How It Works", "Pricing", "For Sellers"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} style={{ color: colors.mutedForeground, textDecoration: "none", fontSize: "0.875rem", fontWeight: 500, transition: "color 0.3s" }} className="hover:text-white">
                {item}
              </a>
            ))}
          </div>

          {/* Desktop Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }} className="md-flex">
            <Button variant="ghost">Log In</Button>
            <Button variant="hero" size="default">Start Selling</Button>
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: "none", border: "none", color: colors.foreground, cursor: "pointer", padding: "0.5rem" }} className="md-hidden">
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div style={{ padding: "1.5rem 1rem", borderTop: `1px solid ${colors.border}` }} className="md-hidden animate-fade-in">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {["Features", "How It Works", "Pricing", "For Sellers"].map((item) => (
                <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} style={{ color: colors.mutedForeground, textDecoration: "none", fontWeight: 500, padding: "0.5rem 0" }}>
                  {item}
                </a>
              ))}
              <div style={{ paddingTop: "1rem", borderTop: `1px solid ${colors.border}`, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Button variant="ghost" style={{ width: "100%" }}>Log In</Button>
                <Button variant="hero" style={{ width: "100%" }}>Start Selling</Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section style={{
        ...sectionStyle,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: "6rem",
        position: "relative",
      }}>
        {/* Background Image */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(https://picsum.photos/seed/hero-bg/1920/1080)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }} data-ai-hint="social media commerce" />
        <div style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to bottom, ${colors.dark}f2 0%, ${colors.dark}cc 50%, ${colors.dark} 100%)`,
        }} />

        {/* Animated Orbs */}
        <AnimatedOrb color={`${colors.primary}33`} size="24rem" top="5rem" left="10%" />
        <AnimatedOrb color={`${colors.secondary}26`} size="20rem" bottom="5rem" right="10%" delay={2} />
        <AnimatedOrb color={`${colors.gold}1a`} size="35rem" top="50%" left="50%" delay={1} />

        <div style={{ ...containerStyle, position: "relative", zIndex: 10, textAlign: "center" }}>
          {/* Badge */}
          <GlassCard style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "9999px", marginBottom: "2rem" }} className="animate-fade-in">
            <Sparkles size={16} style={{ color: colors.gold }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>The World's #1 Social Commerce Platform</span>
          </GlassCard>

          {/* Heading */}
          <h1 style={{ ...headingStyle, fontSize: "clamp(2.5rem, 8vw, 5rem)", marginBottom: "1.5rem" }} className="animate-slide-up">
            <span style={{ color: colors.foreground }}>Where Videos</span>
            <br />
            <span className="text-gradient">Become Income</span>
          </h1>

          {/* Subheading */}
          <p style={{ fontSize: "clamp(1rem, 3vw, 1.375rem)", color: colors.mutedForeground, maxWidth: "48rem", margin: "0 auto 2.5rem", lineHeight: 1.6 }} className="animate-slide-up">
            Whether you sell products, promote brands, or create viral videos — 
            <span style={{ color: colors.primary, fontWeight: 600 }}> Go Earn </span> 
            turns your hustle into real earnings.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", justifyContent: "center", alignItems: "center", marginBottom: "3rem" }} className="sm:flex-row animate-slide-up">
            <Button variant="hero" size="xl">
              <Upload size={20} />
              Start Selling Now
              <ArrowRight size={20} />
            </Button>
            <Button variant="heroOutline" size="xl">
              <Play size={20} />
              Watch How It Works
            </Button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", maxWidth: "56rem", margin: "0 auto" }} className="animate-fade-in">
            {[
              { value: "50K+", label: "Active Sellers" },
              { value: "1M+", label: "Products Sold" },
              { value: "0%", label: "Listing Fees" },
              { value: "24/7", label: "Support" },
            ].map((stat, index) => (
              <GlassCard key={index} style={{ borderRadius: "1rem", padding: "1.25rem", textAlign: "center" }} className="hover-scale transition-all">
                <div className="text-gradient" style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{stat.value}</div>
                <div style={{ fontSize: "0.875rem", color: colors.mutedForeground, marginTop: "0.25rem" }}>{stat.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div style={{ position: "absolute", bottom: "2rem", left: "50%", transform: "translateX(-50%)" }} className="animate-bounce-subtle hidden md:block">
          <div style={{ width: "1.5rem", height: "2.5rem", borderRadius: "9999px", border: `2px solid ${colors.mutedForeground}4d`, display: "flex", justifyContent: "center", paddingTop: "0.5rem" }}>
            <div style={{ width: "0.25rem", height: "0.5rem", background: colors.primary, borderRadius: "9999px" }} />
          </div>
        </div>
      </section>

      {/* ===== FOUNDING SELLER SECTION ===== */}
      <section style={{ ...sectionStyle, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(https://picsum.photos/seed/pattern-bg/1920/1080)`, backgroundSize: "cover", opacity: 0.05 }} data-ai-hint="abstract pattern" />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${colors.primary}0d 0%, transparent 50%, ${colors.secondary}0d 100%)` }} />

        <div style={{ ...containerStyle, position: "relative", zIndex: 10 }}>
          <div style={{ maxWidth: "56rem", margin: "0 auto", textAlign: "center" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "9999px", background: `${colors.gold}33`, color: colors.gold, fontSize: "0.875rem", fontWeight: 600, marginBottom: "1.5rem" }} className="animate-pulse-glow">
              <Crown size={16} />
              <span>Limited Opportunity</span>
            </div>

            <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1.5rem" }}>
              Become a <span className="text-gradient">Founding Seller</span>
            </h2>

            <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, marginBottom: "3rem", maxWidth: "40rem", margin: "0 auto 3rem" }}>
              This is your exclusive chance to grow with us from Day One.
              <span style={{ display: "block", marginTop: "0.5rem", color: colors.foreground, fontWeight: 600 }}>Join early. Be discovered early. Earn early.</span>
            </p>

            {/* Benefits Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
              {[
                { icon: Rocket, title: "Early Access", description: "Get featured before the crowd arrives", gradient: gradients.primary },
                { icon: Star, title: "Priority Support", description: "Direct line to our success team", gradient: gradients.gold },
                { icon: Crown, title: "Founding Badge", description: "Exclusive recognition forever", gradient: gradients.secondary }
              ].map((benefit, index) => (
                <div key={index} style={{
                  padding: "2rem",
                  borderRadius: "1.5rem",
                  background: colors.darkCard,
                  border: `1px solid ${colors.border}`,
                  transition: "all 0.5s ease",
                }} className="hover-scale transition-all">
                  <div style={{
                    width: "4rem",
                    height: "4rem",
                    borderRadius: "1rem",
                    background: benefit.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.5rem",
                    boxShadow: `0 10px 30px ${colors.primary}40`,
                  }}>
                    <benefit.icon size={28} style={{ color: colors.dark }} />
                  </div>
                  <h3 style={{ ...headingStyle, fontSize: "1.25rem", marginBottom: "0.5rem" }}>{benefit.title}</h3>
                  <p style={{ color: colors.mutedForeground }}>{benefit.description}</p>
                </div>
              ))}
            </div>

            <Button variant="gold" size="xl">
              <Rocket size={20} />
              Claim Your Founding Spot
              <ArrowRight size={20} />
            </Button>
          </div>
        </div>
      </section>

      {/* ===== UPLOAD SELL EARN SECTION ===== */}
      <section style={{ ...sectionStyle, background: colors.darkCard }}>
        <div style={containerStyle}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1rem" }}>
              <span style={{ color: colors.primary }}>Upload</span> • <span style={{ color: colors.secondary }}>Sell</span> • <span style={{ color: colors.gold }}>Earn</span>
            </h2>
            <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, maxWidth: "40rem", margin: "0 auto" }}>
              Share real videos and authentic content. Buyers trust what they can see — your videos do the selling.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
            {[
              { icon: Video, title: "Video-First Commerce", description: "Videos convert 10× more than images. Show products in action.", gradient: gradients.primary },
              { icon: ImageIcon, title: "Rich Media Upload", description: "Videos, images, descriptions — everything optimized for conversion.", gradient: gradients.secondary },
              { icon: Zap, title: "Instant Publishing", description: "Upload once, reach millions. Products go live in seconds.", gradient: gradients.gold },
              { icon: TrendingUp, title: "AI-Powered Discovery", description: "Our algorithm puts products in front of the right buyers.", gradient: gradients.accent }
            ].map((feature, index) => (
              <div key={index} style={{
                padding: "2rem",
                borderRadius: "1.5rem",
                background: colors.dark,
                border: `1px solid ${colors.border}`,
                transition: "all 0.5s ease",
              }} className="hover-scale transition-all">
                <div style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "1rem",
                  background: feature.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1.5rem",
                  boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
                }}>
                  <feature.icon size={28} style={{ color: colors.dark }} />
                </div>
                <h3 style={{ ...headingStyle, fontSize: "1.25rem", marginBottom: "0.75rem" }}>{feature.title}</h3>
                <p style={{ color: colors.mutedForeground }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== GO LIVE SECTION ===== */}
      <section style={{ ...sectionStyle, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${colors.neonPink}0d 0%, ${colors.dark} 50%, ${colors.primary}0d 100%)` }} />

        <div style={{ ...containerStyle, position: "relative", zIndex: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "4rem", alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "9999px", background: `${colors.neonPink}33`, color: colors.neonPink, fontSize: "0.875rem", fontWeight: 600, marginBottom: "1.5rem" }}>
                <Radio size={16} className="animate-pulse" />
                <span>LIVE Feature</span>
              </div>

              <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1.5rem" }}>
                Go Live & <span style={{ color: colors.neonPink }}>Multiply</span> Your Sales
              </h2>

              <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, marginBottom: "2rem" }}>
                Host live sessions just like TikTok or Instagram. Answer questions instantly, showcase products in real time, and boost trust & sales.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
                {[
                  { icon: Users, text: "Reach thousands of viewers instantly" },
                  { icon: MessageCircle, text: "Answer questions in real-time" },
                  { icon: TrendingUp, text: "3× higher conversion than regular posts" },
                ].map((item, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: "3rem", height: "3rem", borderRadius: "0.75rem", background: `${colors.neonPink}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <item.icon size={20} style={{ color: colors.neonPink }} />
                    </div>
                    <span style={{ color: colors.foreground, fontSize: "1.125rem" }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <Button variant="neon" size="lg">
                <Radio size={20} />
                Start Your First Live
              </Button>
            </div>

            {/* Phone Mockup */}
            <div style={{ position: "relative", maxWidth: "320px", margin: "0 auto" }}>
              <div style={{
                background: colors.darkCard,
                borderRadius: "3rem",
                padding: "0.75rem",
                border: `4px solid ${colors.muted}`,
                boxShadow: `0 25px 50px rgba(0,0,0,0.5)`,
              }}>
                <div style={{ borderRadius: "2.25rem", overflow: "hidden", position: "relative", aspectRatio: "9/16" }}>
                  <img src="https://picsum.photos/seed/liveseller/400/711" alt="Live selling session" style={{ width: "100%", height: "100%", objectFit: "cover" }} data-ai-hint="live selling stream" />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }} />

                  {/* Live Badge */}
                  <div style={{ position: "absolute", top: "1rem", left: "1rem", display: "flex", gap: "0.5rem" }}>
                    <div style={{ padding: "0.375rem 0.75rem", background: "#ef4444", borderRadius: "9999px", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <div style={{ width: "0.5rem", height: "0.5rem", background: colors.foreground, borderRadius: "50%" }} className="animate-pulse" />
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: colors.foreground }}>LIVE</span>
                    </div>
                    <div style={{ padding: "0.375rem 0.75rem", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", borderRadius: "9999px" }}>
                      <span style={{ fontSize: "0.75rem", color: colors.foreground }}>2.4K watching</span>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div style={{ position: "absolute", bottom: "1rem", left: "1rem", right: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <GlassCard style={{ padding: "0.5rem 0.75rem", borderRadius: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem" }}>"How much for the bag?"</span>
                    </GlassCard>
                    <GlassCard style={{ padding: "0.5rem 0.75rem", borderRadius: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem" }}>"Shipping to Mombasa?"</span>
                    </GlassCard>
                  </div>
                </div>
              </div>

              {/* Floating Badges */}
              <div style={{ position: "absolute", top: "-1rem", right: "-1rem", padding: "0.5rem 1rem", background: colors.gold, borderRadius: "9999px", color: colors.dark, fontWeight: 700, fontSize: "0.875rem", boxShadow: `0 10px 30px ${colors.gold}40` }} className="animate-bounce-subtle">
                +500 KES
              </div>
              <div style={{ position: "absolute", bottom: "-1rem", left: "-1rem", padding: "0.5rem 1rem", background: colors.neonGreen, borderRadius: "9999px", color: colors.dark, fontWeight: 700, fontSize: "0.875rem", boxShadow: `0 10px 30px ${colors.neonGreen}40`, animationDelay: "0.5s" }} className="animate-bounce-subtle">
                Order Placed!
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RESELLER SECTION ===== */}
      <section style={{ ...sectionStyle, background: colors.darkCard }}>
        <div style={containerStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "4rem", alignItems: "center" }} className="lg:grid-cols-2">
            
            <div style={{ order: 2, paddingBottom: '2rem', textAlign: 'center' }} className="lg:order-1 lg:text-left lg:pb-0">
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "9999px", background: `${colors.secondary}33`, color: colors.secondary, fontSize: "0.875rem", fontWeight: 600, marginBottom: "1.5rem" }}>
                <Share2 size={16} />
                <span>Reseller Program</span>
              </div>

              <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1.5rem", lineHeight: 1.2 }}>
                Your Sales Army <span style={{ color: colors.secondary }}>Awaits</span>
              </h2>

              <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, marginBottom: "2rem" }}>
                Enable resellers to promote your products across the world. You pay only when they bring a sale.
                <span style={{ display: "block", marginTop: "1rem", fontWeight: 600, color: colors.foreground }}>This is how smart selling is done.</span>
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
                {["Zero upfront costs — pay only on success", "Unlimited resellers can join your network", "Track performance & earnings in real-time", "Automatic commission payouts"].map((benefit, index) => (
                  <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <CheckCircle size={24} style={{ color: colors.secondary, flexShrink: 0 }} />
                    <span style={{ color: colors.foreground, fontSize: "1.125rem" }}>{benefit}</span>
                  </div>
                ))}
              </div>

              <Button variant="secondary" size="lg">
                <Users size={20} />
                Enable Reseller Program
              </Button>
            </div>
            
            {/* Network Visualization */}
            <div style={{ position: "relative", aspectRatio: "1", maxWidth: "400px", margin: "0 auto", order: 1 }} className="lg:order-2">
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                {/* Central Node */}
                <div style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "8rem",
                  height: "8rem",
                  borderRadius: "50%",
                  background: gradients.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  boxShadow: `0 0 50px ${colors.primary}77`,
                }}>
                  <span style={{ color: colors.dark, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>YOU</span>
                </div>
                
                {/* Surrounding Nodes */}
                {[
                  { top: '15%', left: '15%', size: '4rem', gradient: gradients.secondary, delay: 0 },
                  { top: '20%', right: '10%', size: '5rem', gradient: gradients.gold, delay: 1.5, rotate: '-15deg' },
                  { bottom: '15%', left: '20%', size: '3.5rem', gradient: gradients.neonPink, delay: 3 },
                  { bottom: '25%', right: '15%', size: '4.5rem', gradient: gradients.accent, delay: 4.5, rotate: '20deg' }
                ].map((node, index) => (
                  <div key={index} className="animate-float" style={{
                    position: 'absolute',
                    top: node.top,
                    left: node.left,
                    right: node.right,
                    bottom: node.bottom,
                    width: node.size,
                    height: node.size,
                    background: node.gradient,
                    borderRadius: '50%',
                    transform: `rotate(${node.rotate || '0deg'})`,
                    boxShadow: `0 0 30px ${colors.dark}55`,
                    animationDelay: `${node.delay}s`,
                  }}></div>
                ))}
                
                {/* Floating Text */}
                <div className="animate-float" style={{ position: 'absolute', top: '30%', left: '75%', color: colors.neonGreen, fontWeight: 700, fontSize: '1rem', animationDelay: '0.5s' }}>+180 KES</div>
                <div className="animate-float" style={{ position: 'absolute', bottom: '35%', left: '5%', color: colors.gold, fontWeight: 700, fontSize: '0.8rem', animationDelay: '2.5s' }}>+50 KES</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== CHAT SECTION ===== */}
      <section style={sectionStyle}>
        <div style={containerStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "4rem", alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "9999px", background: `${colors.primary}1a`, color: colors.primary, fontSize: "0.875rem", fontWeight: 600, marginBottom: "1.5rem" }}>
                <MessageCircle size={16} />
                <span>Instant Messaging</span>
              </div>

              <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1.5rem" }}>
                Chat With <span style={{ color: colors.primary }}>Buyers</span> Directly
              </h2>

              <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, marginBottom: "2.5rem" }}>
                Instant messaging means faster answers and faster buying decisions. Build trust. Build relationships. Build repeat customers.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                {[
                  { icon: Send, label: "Instant Replies", value: "< 1 min" },
                  { icon: Clock, label: "Available", value: "24/7" },
                  { icon: Heart, label: "Repeat Buyers", value: "+65%" },
                  { icon: MessageCircle, label: "Daily Messages", value: "10K+" },
                ].map((stat, index) => (
                  <div key={index} style={{
                    padding: "1.25rem",
                    borderRadius: "1rem",
                    background: colors.darkCard,
                    border: `1px solid ${colors.border}`,
                  }} className="hover-scale transition-all">
                    <stat.icon size={24} style={{ color: colors.primary, marginBottom: "0.75rem" }} />
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>{stat.value}</div>
                    <div style={{ fontSize: "0.875rem", color: colors.mutedForeground }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Mockup */}
            <div style={{ maxWidth: "380px", margin: "0 auto" }}>
              <div style={{
                background: colors.darkCard,
                borderRadius: "1.5rem",
                boxShadow: `0 25px 50px rgba(0,0,0,0.5)`,
                border: `1px solid ${colors.border}`,
                overflow: "hidden",
              }}>
                {/* Chat Header */}
                <div style={{ padding: "1rem", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", gap: "0.75rem", background: `${colors.muted}4d` }}>
                  <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: gradients.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: colors.dark, fontWeight: 700 }}>S</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>Sarah Wanjiku</div>
                    <div style={{ fontSize: "0.75rem", color: colors.neonGreen, display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <div style={{ width: "0.5rem", height: "0.5rem", background: colors.neonGreen, borderRadius: "50%" }} className="animate-pulse" />
                      Online now
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div style={{ padding: "1rem", minHeight: "280px", display: "flex", flexDirection: "column", gap: "0.75rem", background: `${colors.muted}1a` }}>
                  {[
                    { sender: "buyer", text: "Hi! Is this bag still available?", time: "10:32 AM" },
                    { sender: "seller", text: "Yes! We have 3 colors in stock 🎉", time: "10:33 AM" },
                    { sender: "buyer", text: "Can I get it delivered to Mombasa?", time: "10:34 AM" },
                    { sender: "seller", text: "Absolutely! Free shipping. Ready to order? 📦", time: "10:34 AM" },
                  ].map((msg, index) => (
                    <div key={index} style={{ display: "flex", justifyContent: msg.sender === "seller" ? "flex-end" : "flex-start" }} className="animate-fade-in">
                      <div style={{
                        maxWidth: "80%",
                        padding: "0.875rem",
                        borderRadius: msg.sender === "seller" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                        background: msg.sender === "seller" ? colors.primary : colors.muted,
                        color: msg.sender === "seller" ? colors.dark : colors.foreground,
                      }}>
                        <p style={{ fontSize: "0.875rem" }}>{msg.text}</p>
                        <span style={{ fontSize: "0.75rem", opacity: 0.7, display: "block", marginTop: "0.25rem" }}>{msg.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div style={{ padding: "1rem", borderTop: `1px solid ${colors.border}`, display: "flex", gap: "0.75rem" }}>
                  <input type="text" placeholder="Type your message..." style={{
                    flex: 1,
                    padding: "0.75rem 1rem",
                    borderRadius: "0.75rem",
                    background: colors.muted,
                    border: "none",
                    color: colors.foreground,
                    fontSize: "0.875rem",
                    outline: "none",
                  }} />
                  <button style={{
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "0.75rem",
                    background: gradients.primary,
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }} className="hover-scale transition-all">
                    <Send size={20} style={{ color: colors.dark }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY SELLERS LOVE SECTION ===== */}
      <section style={{ ...sectionStyle, background: colors.darkCard }}>
        <div style={containerStyle}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1rem" }}>
              Why Sellers <span style={{ color: colors.primary }}>Love</span> Go Earn
            </h2>
            <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, maxWidth: "40rem", margin: "0 auto" }}>
              Your growth is the mission. We give you the tools — you bring the hustle.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", maxWidth: "72rem", margin: "0 auto" }}>
            {[
              { icon: Star, title: "0% Listing Fees", description: "List unlimited products without any fees", gradient: gradients.gold },
              { icon: Upload, title: "Unlimited Uploads", description: "No caps on products or content", gradient: gradients.primary },
              { icon: Video, title: "TikTok-Style Discovery", description: "Your products go viral naturally", gradient: gradients.neonPink },
              { icon: Users, title: "Built-in Resellers", description: "Grow your sales army instantly", gradient: gradients.secondary },
              { icon: CreditCard, title: "Fast Payouts", description: "Get paid within 24-48 hours", gradient: gradients.neonGreen },
              { icon: BarChart3, title: "AI Recommendations", description: "Smart product suggestions", gradient: gradients.accent },
              { icon: Shield, title: "Seller Protection", description: "Your business is always safe", gradient: gradients.primary },
              { icon: Lock, title: "Secure Transactions", description: "End-to-end encryption", gradient: gradients.secondary },
            ].map((benefit, index) => (
              <div key={index} style={{
                padding: "1.5rem",
                borderRadius: "1rem",
                background: colors.dark,
                border: `1px solid ${colors.border}`,
                transition: "all 0.3s ease",
              }} className="hover-scale transition-all">
                <div style={{
                  width: "3.5rem",
                  height: "3.5rem",
                  borderRadius: "1rem",
                  background: benefit.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                }}>
                  <benefit.icon size={24} style={{ color: colors.dark }} />
                </div>
                <h3 style={{ ...headingStyle, fontSize: "1.125rem", marginBottom: "0.5rem" }}>{benefit.title}</h3>
                <p style={{ fontSize: "0.875rem", color: colors.mutedForeground }}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ROADMAP SECTION ===== */}
      <section style={sectionStyle}>
        <div style={containerStyle}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 5vw, 3.5rem)", marginBottom: "1rem" }}>
              Your Roadmap to <span style={{ color: colors.primary }}>First Sales</span>
            </h2>
            <p style={{ fontSize: "1.125rem", color: colors.mutedForeground, maxWidth: "40rem", margin: "0 auto" }}>
              Follow these simple steps and start earning today.
            </p>
          </div>

          <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {[
                { number: "1", icon: User, title: "Complete Your Shop Profile", description: "Add your logo, banner & bio to build trust.", gradient: gradients.primary },
                { number: "2", icon: Upload, title: "Upload Your First Product", description: "Videos convert 10× more than images — use them.", gradient: gradients.secondary },
                { number: "3", icon: DollarSign, title: "Set Stock & Pricing", description: "Simple, clean, easy. No confusing fees.", gradient: gradients.gold },
                { number: "4", icon: Users, title: "Enable Reseller Program", description: "Let others promote your products for free.", gradient: gradients.accent },
                { number: "5", icon: Radio, title: "Go Live", description: "Reach more viewers and sell faster.", gradient: gradients.neonPink },
                { number: "6", icon: Share2, title: "Share Your Shop Link", description: "Post it everywhere — WhatsApp, Facebook, IG, TikTok.", gradient: gradients.neonGreen }
              ].map((step, index) => (
                <div key={index} style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
                  <div style={{
                    width: "4.5rem",
                    height: "4.5rem",
                    borderRadius: "1rem",
                    background: step.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
                  }} className="hover-scale transition-all">
                    <step.icon size={28} style={{ color: colors.dark }} />
                  </div>
                  <div style={{ paddingTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 700, color: colors.mutedForeground }}>Step {step.number}</span>
                    <h3 style={{ ...headingStyle, fontSize: "1.375rem", marginBottom: "0.5rem" }}>{step.title}</h3>
                    <p style={{ fontSize: "1.125rem", color: colors.mutedForeground }}>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section style={{ ...sectionStyle, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${colors.primary}1a 0%, ${colors.dark} 50%, ${colors.secondary}1a 100%)` }} />
        <AnimatedOrb color={`${colors.primary}33`} size="35rem" top="50%" left="50%" />
        <AnimatedOrb color={`${colors.gold}1a`} size="24rem" top="0" right="0" delay={1} />
        <AnimatedOrb color={`${colors.secondary}1a`} size="24rem" bottom="0" left="0" delay={2} />

        <div style={{ ...containerStyle, position: "relative", zIndex: 10 }}>
          <div style={{ maxWidth: "56rem", margin: "0 auto", textAlign: "center" }}>
            <div style={{
              width: "6rem",
              height: "6rem",
              borderRadius: "1.5rem",
              background: gradients.hero,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2.5rem",
              boxShadow: `0 20px 60px ${colors.primary}66`,
            }} className="animate-pulse-glow">
              <Rocket size={40} style={{ color: colors.dark }} />
            </div>

            <h2 style={{ ...headingStyle, fontSize: "clamp(2rem, 6vw, 4rem)", marginBottom: "1.5rem" }}>
              Ready to Grow With <span className="text-gradient">Go Earn</span>?
            </h2>

            <p style={{ fontSize: "clamp(1rem, 3vw, 1.375rem)", color: colors.mutedForeground, marginBottom: "3rem", maxWidth: "40rem", margin: "0 auto 3rem" }}>
              Start your journey today. Join thousands of entrepreneurs who are turning their passion into profit.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", justifyContent: "center", alignItems: "center", marginBottom: "3rem" }} className="sm:flex-row">
              <Button variant="hero" size="xl">
                <Upload size={20} />
                Upload Your First Product
                <ArrowRight size={20} />
              </Button>
              <Button variant="heroOutline" size="xl">
                <User size={20} />
                Customize Your Shop
              </Button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "1.5rem" }}>
              {["Free to Start", "No Hidden Fees", "24/7 Support", "Secure Payments"].map((badge, index) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: colors.mutedForeground, fontSize: "0.875rem" }}>
                  <div style={{ width: "0.5rem", height: "0.5rem", background: colors.neonGreen, borderRadius: "50%" }} className="animate-pulse" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer style={{ background: colors.darkCard, borderTop: `1px solid ${colors.border}`, padding: "4rem 1rem 2rem" }}>
        <div style={containerStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "3rem", marginBottom: "3rem" }}>
            {/* Logo & Description */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{
                  width: "3rem",
                  height: "3rem",
                  borderRadius: "0.75rem",
                  background: gradients.hero,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span style={{ color: colors.dark, fontWeight: 700, fontSize: "1.5rem", fontFamily: "'Space Grotesk', sans-serif" }}>G</span>
                </div>
                <span style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Go Earn</span>
              </div>
              <p style={{ color: colors.mutedForeground, marginBottom: "1.5rem" }}>
                The world's next-generation social commerce platform. Where videos become income.
              </p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {[Facebook, Twitter, Instagram, Youtube].map((Icon, index) => (
                  <a key={index} href="#" style={{
                    width: "2.75rem",
                    height: "2.75rem",
                    borderRadius: "0.75rem",
                    background: colors.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.mutedForeground,
                    textDecoration: "none",
                  }} className="hover-scale transition-all">
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 style={{ ...headingStyle, fontSize: "1.125rem", marginBottom: "1.5rem" }}>Quick Links</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {["Home", "Features", "Pricing", "For Sellers", "For Resellers", "Blog"].map((link) => (
                  <li key={link}>
                    <a href="#" style={{ color: colors.mutedForeground, textDecoration: "none" }} className="transition-all">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 style={{ ...headingStyle, fontSize: "1.125rem", marginBottom: "1.5rem" }}>Support</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {["Help Center", "FAQs", "Contact Us", "Privacy Policy", "Terms of Service"].map((link) => (
                  <li key={link}>
                    <a href="#" style={{ color: colors.mutedForeground, textDecoration: "none" }} className="transition-all">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 style={{ ...headingStyle, fontSize: "1.125rem", marginBottom: "1.5rem" }}>Contact Us</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[
                  { icon: Mail, text: "hello@goearn.co" },
                  { icon: Phone, text: "+1 (555) 000-0000" },
                  { icon: MapPin, text: "Global" },
                ].map((item, index) => (
                  <li key={index} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{
                      width: "2.75rem",
                      height: "2.75rem",
                      borderRadius: "0.75rem",
                      background: colors.muted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <item.icon size={20} style={{ color: colors.primary }} />
                    </div>
                    <span style={{ color: colors.mutedForeground }}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div style={{ paddingTop: "2rem", borderTop: `1px solid ${colors.border}`, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <p style={{ color: colors.mutedForeground, fontSize: "0.875rem" }}>© 2025 Go Earn. All rights reserved.</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: colors.mutedForeground, fontSize: "0.875rem" }}>Made with</span>
              <Heart size={16} style={{ color: colors.secondary, fill: colors.secondary }} />
              <span style={{ color: colors.mutedForeground, fontSize: "0.875rem" }}>for the world</span>
            </div>
          </div>
        </div>
      </footer>
      <CookieConsentBanner />
    </main>
  );
};

export default Index;
