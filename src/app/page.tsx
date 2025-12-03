
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/firebase/auth/use-user';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import React from "react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bot, Megaphone, ShoppingBag, UploadCloud, Users, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function GoEarnHomepage() {
  return (
    <div className="w-full min-h-screen bg-black text-white">
      {/* HERO SECTION */}
      <section className="relative w-full h-[90vh] flex items-center justify-center overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          autoPlay
          loop
          muted
          playsInline
          src="https://cdn.coverr.co/videos/coverr-a-mobile-phone-on-a-red-background-1083/1080p.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-primary/20 to-black/80 pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight font-headline">
              The Future of Social Commerce is Here.
            </h1>
            <p className="mt-4 text-primary/80 max-w-2xl mx-auto text-lg">
              Go Earn is the ultimate video marketplace for Africa. Sell, go live, and empower a network of resellers to amplify your reach.
            </p>

            <div className="mt-8 flex gap-4 flex-wrap justify-center">
              <Button asChild size="lg" className="font-bold">
                <Link href="/signup?role=seller">
                  Start Selling
                  <ArrowRight />
                </Link>
              </Button>
               <Button asChild size="lg" variant="outline">
                <Link href="/live">
                  Browse Products
                </Link>
              </Button>
            </div>
          </div>
      </section>

      {/* THREE USER CARDS */}
      <section className="py-20 px-6 grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <Card className="bg-card/80 text-center border-primary/20">
            <CardHeader><CardTitle>For Buyers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <ul className="space-y-2 text-muted-foreground">
                    <li>• Discover trending products</li>
                    <li>• Watch real product videos</li>
                    <li>• Chat with sellers instantly</li>
                </ul>
                <Button asChild variant="secondary" className="w-full">
                    <Link href="/live">Start Watching</Link>
                </Button>
            </CardContent>
        </Card>

        <Card className="bg-card/80 text-center border-primary/50 ring-2 ring-primary/50">
            <CardHeader><CardTitle>For Sellers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <ul className="space-y-2 text-muted-foreground">
                    <li>• Upload videos & images</li>
                    <li>• Go Live & boost sales</li>
                    <li>• Build a reseller army</li>
                </ul>
                <Button asChild className="w-full">
                    <Link href="/signup?role=seller">Start Selling</Link>
                </Button>
            </CardContent>
        </Card>

        <Card className="bg-card/80 text-center border-primary/20">
            <CardHeader><CardTitle>For Resellers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <ul className="space-y-2 text-muted-foreground">
                    <li>• Share products, earn cash</li>
                    <li>• No capital or stock needed</li>
                    <li>• Daily commission payouts</li>
                </ul>
                <Button asChild variant="secondary" className="w-full">
                    <Link href="/signup?role=reseller">Start Earning</Link>
                </Button>
            </CardContent>
        </Card>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-6 bg-card/50 text-center">
        <h2 className="text-3xl font-bold mb-12 font-headline">How Go Earn Works</h2>
        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-primary/10 p-4 rounded-full border-2 border-primary/20"><UploadCloud className="h-8 w-8 text-primary"/></div>
            <h3 className="text-xl font-bold mb-2">1. Upload Products</h3>
            <p className="text-muted-foreground">Sellers upload videos and images of their products. Authenticity sells.</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-primary/10 p-4 rounded-full border-2 border-primary/20"><Users className="h-8 w-8 text-primary"/></div>
            <h3 className="text-xl font-bold mb-2">2. Promote & Resell</h3>
            <p className="text-muted-foreground">Sellers go live and resellers share products to their networks to earn commissions.</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-primary/10 p-4 rounded-full border-2 border-primary/20"><ShoppingBag className="h-8 w-8 text-primary"/></div>
            <h3 className="text-xl font-bold mb-2">3. Buy Securely</h3>
            <p className="text-muted-foreground">Buyers watch, chat, and purchase instantly with confidence.</p>
          </div>
        </div>
      </section>
      
      {/* TIKTOK BOOST */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            <div>
                <Badge className="bg-primary/10 text-primary border-primary/30">New Feature</Badge>
                <h2 className="text-3xl font-bold mt-4 font-headline">Supercharge Your Sales with TikTok Boost</h2>
                <p className="text-muted-foreground mt-4 text-lg">Don't just sell, go viral. Use your AI Points to launch your product videos as targeted ads directly on TikTok, reaching millions of potential customers across the region.</p>
                <ul className="space-y-3 mt-6 text-foreground">
                    <li className="flex items-center gap-3"><Megaphone className="text-primary"/> <span>Reach millions with targeted campaigns.</span></li>
                    <li className="flex items-center gap-3"><Bot className="text-primary"/> <span>Our AI helps you optimize your ads for maximum impact.</span></li>
                    <li className="flex items-center gap-3"><Video className="text-primary"/> <span>Managed directly from your Go Earn dashboard.</span></li>
                </ul>
            </div>
            <div>
                 <video
                  className="w-full rounded-xl shadow-2xl shadow-primary/10 border-2 border-primary/20"
                  autoPlay
                  loop
                  muted
                  playsInline
                  src="https://cdn.coverr.co/videos/coverr-a-close-up-of-a-smartphone-5527/1080p.mp4"
                />
            </div>
        </div>
      </section>


      {/* FOOTER */}
      <footer className="py-10 px-6 bg-card text-muted-foreground">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="font-bold text-xl font-headline text-foreground">Go Earn</div>
            </div>
            <p className="text-sm">Empowering the next generation of African entrepreneurs through video commerce.</p>
          </div>
          <div>
            <div className="font-semibold text-foreground">Product</div>
            <ul className="mt-2 text-sm space-y-2">
              <li><Link href="#how-it-works" className="hover:text-primary">How It Works</Link></li>
              <li><Link href="/signup?role=seller" className="hover:text-primary">For Sellers</Link></li>
              <li><Link href="/signup?role=reseller" className="hover:text-primary">For Resellers</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-foreground">Company</div>
            <ul className="mt-2 text-sm space-y-2">
              <li><Link href="/dashboard/seller/about" className="hover:text-primary">About Us</Link></li>
              <li><Link href="#" className="hover:text-primary">Careers</Link></li>
              <li><Link href="/dashboard/seller/help" className="hover:text-primary">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 text-sm border-t border-border pt-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>© {new Date().getFullYear()} Go Earn. All rights reserved.</div>
            <div className="text-xs">Terms • Privacy</div>
          </div>
        </div>
      </footer>
    </div>
  );
}


export default function HomePage() {
    const { user, isLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Capture and store the reseller referral ID from the URL
    useEffect(() => {
        const refId = searchParams.get('ref');
        if (refId) {
            localStorage.setItem('resellerRefId', refId);
        }
    }, [searchParams]);

    // This effect handles role-based redirection after the component has rendered.
    useEffect(() => {
        if (isLoading || isProfileLoading) {
            return; // Wait until user data is loaded
        }

        if (user && userProfile) {
            if (userProfile.userRole === 'admin') {
                router.replace('/dashboard/admin');
            } else if (userProfile.userRole === 'seller') {
                router.replace('/dashboard/seller');
            } else if (userProfile.userRole === 'reseller') {
                router.replace('/dashboard/reseller');
            } else {
                 router.replace('/live'); // Default for buyers
            }
        }
    }, [user, userProfile, isLoading, isProfileLoading, router]);

    // Show a loading state while we determine the user's role and redirect
    if (isLoading || isProfileLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black text-white">
                <p>Loading...</p>
            </div>
        );
    }
    
    // If no user, show the landing page.
    if (!user) {
        return (
          <MainLayout>
              <GoEarnHomepage />
          </MainLayout>
        );
    }

    // Fallback for authenticated users before redirect happens
    return (
         <div className="flex h-screen w-full items-center justify-center bg-black text-white">
            <p>Redirecting to your dashboard...</p>
        </div>
    );
}
