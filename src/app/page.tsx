'use client';
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useUser, useUserProfile } from '@/firebase';
import { 
  Play, Upload, ArrowRight, Sparkles, Rocket, Crown, Star, Video, Image as ImageIcon, Zap, 
  TrendingUp, Radio, Users, MessageCircle, Share2, CheckCircle, Send, 
  Clock, Heart, Package, Truck, MapPin, BarChart3, DollarSign, Eye, 
  ShoppingBag, Shield, Lock, CreditCard, User, Handshake, Menu, X, Facebook, 
  Twitter, Instagram, Youtube, Mail, Phone
} from "lucide-react";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { LandingLayout } from "@/components/layout/landing-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from 'next/link';

// ===== MAIN INDEX COMPONENT =====
const Index = () => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const isLoading = isUserLoading || isProfileLoading;

  useEffect(() => {
    if (!isLoading && user && userProfile) {
      switch (userProfile.userRole) {
        case 'seller':
          router.replace('/dashboard/seller');
          break;
        case 'reseller':
          router.replace('/dashboard/reseller');
          break;
        case 'admin':
          router.replace('/dashboard/admin');
          break;
        case 'buyer':
        default:
          router.replace('/buyer/dashboard');
          break;
      }
    }
  }, [user, userProfile, isLoading, router]);

  if (isLoading || (user && userProfile)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
        Loading...
      </div>
    );
  }

  return (
    <LandingLayout>
      <div className="container mx-auto max-w-5xl py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold font-headline">
          The Social Marketplace for Africa
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Go Earn is a video-first platform that connects sellers with buyers and resellers, making it easier than ever to turn your hustle into a thriving business.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/signup?role=seller">Start Selling</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/live">Watch Live</Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
                <CardContent className="p-6 text-center">
                    <Video className="h-10 w-10 mx-auto text-primary mb-4" />
                    <h3 className="text-xl font-bold">Video-First</h3>
                    <p className="text-muted-foreground mt-2">Showcase your products with engaging videos that build trust and drive sales.</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-6 text-center">
                    <Users className="h-10 w-10 mx-auto text-primary mb-4" />
                    <h3 className="text-xl font-bold">Reseller Network</h3>
                    <p className="text-muted-foreground mt-2">Amplify your reach by letting our network of resellers promote your products for a commission.</p>
                </CardContent>
            </Card>
             <Card>
                <CardContent className="p-6 text-center">
                    <Radio className="h-10 w-10 mx-auto text-primary mb-4" />
                    <h3 className="text-xl font-bold">Live Shopping</h3>
                    <p className="text-muted-foreground mt-2">Connect with customers in real-time, answer questions, and sell products during live shows.</p>
                </CardContent>
            </Card>
        </div>
      </div>
       <CookieConsentBanner />
    </LandingLayout>
  );
};

export default Index;
