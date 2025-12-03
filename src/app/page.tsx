
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { useUser } from '@/firebase/auth/use-user';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import React from "react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function MoneyGoHomepage() {
  return (
    <div className="w-full min-h-screen bg-black text-white font-sans">
      {/* HERO SECTION - Black & Red, Video Background */}
      <section className="relative w-full h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-30"
          autoPlay
          loop
          muted
          playsInline
          src="https://cdn.coverr.co/videos/coverr-a-mobile-phone-on-a-red-background-1083/1080p.mp4"
        />

        {/* Overlay for deep black-red gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-red-900/30 to-black/80 pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              MoneyGo — <span className="text-red-500">The New-Gen Selling Experience</span>
            </h1>
            <p className="mt-4 text-red-200 max-w-xl text-lg">
              Real videos. Real sellers. Real earnings. Sell, go live, resell & buy trending items instantly across Africa.
            </p>

            <div className="mt-6 flex gap-3 flex-wrap">
              <Button asChild>
                <Link
                  href="/signup?role=seller"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg"
                >
                  Start Selling
                </Link>
              </Button>

              <Button asChild variant="outline">
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-red-600 text-red-300 hover:bg-red-900/20"
                >
                  How It Works
                </Link>
              </Button>

              <Button asChild variant="outline">
                <Link
                  href="/live"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-transparent border border-red-700 text-red-400 hover:bg-red-900/10"
                >
                  Browse Products
                </Link>
              </Button>
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-md text-sm">
              <div className="p-3 bg-black/60 rounded-lg border border-red-700">
                <div className="text-xs text-red-200">0%</div>
                <div className="font-semibold text-white">Listing Fees</div>
              </div>
              <div className="p-3 bg-black/60 rounded-lg border border-red-700">
                <div className="text-xs text-red-200">Unlimited</div>
                <div className="font-semibold text-white">Product Uploads</div>
              </div>
              <div className="p-3 bg-black/60 rounded-lg border border-red-700">
                <div className="text-xs text-red-200">Live & Reels</div>
                <div className="font-semibold text-white">Video Discovery</div>
              </div>
              <div className="p-3 bg-black/60 rounded-lg border border-red-700">
                <div className="text-xs text-red-200">Fast</div>
                <div className="font-semibold text-white">Secure Payouts</div>
              </div>
            </div>
          </div>

          {/* Right: Featured product / live preview card */}
          <div className="relative z-10 flex flex-col gap-4 bg-black/60 p-4 rounded-3xl border border-red-700 shadow-2xl">
            <div className="relative rounded-xl overflow-hidden bg-black h-64 border border-red-800">
              <img
                src="https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder"
                alt="product video"
                className="w-full h-full object-cover opacity-95"
              />
              <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-lg text-sm text-red-300 border border-red-700">Live: 1.2k viewers</div>
            </div>

            <div className="mt-3 flex items-start justify-between">
              <div>
                <h3 className="font-bold text-xl text-white">Handmade Woven Bag</h3>
                <p className="text-sm text-red-300">Authentic craft — Nairobi seller</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-extrabold text-red-400">KES 1,499</div>
                <div className="text-xs text-red-200">Free shipping</div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <Button className="flex-1">Message Seller</Button>
              <Button variant="secondary">Buy Now</Button>
            </div>
          </div>
        </div>
      </section>

      {/* THREE USER CARDS */}
      <section className="py-16 px-6 grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Buyers */}
        <div className="bg-black/80 p-8 rounded-2xl shadow-lg text-center border border-red-800">
          <h2 className="text-2xl font-bold mb-4 text-white">For Buyers</h2>
          <ul className="space-y-2 text-red-200">
            <li>• Discover trending products</li>
            <li>• Watch real product videos</li>
            <li>• Chat with sellers instantly</li>
            <li>• Buy with confidence</li>
            <li>• Fast & reliable delivery</li>
          </ul>
          <Button asChild className="mt-6">
            <Link href="/live">Browse Products</Link>
          </Button>
        </div>

        {/* Sellers */}
        <div className="bg-black/80 p-8 rounded-2xl shadow-lg text-center border border-red-800">
          <h2 className="text-2xl font-bold mb-4 text-white">For Sellers</h2>
          <ul className="space-y-2 text-red-200">
            <li>• Upload videos & images</li>
            <li>• Promote your products</li>
            <li>• Go Live & boost sales</li>
            <li>• Easy order management</li>
            <li>• Build a reseller army</li>
          </ul>
          <Button asChild className="mt-6">
            <Link href="/signup?role=seller">Start Selling</Link>
          </Button>
        </div>

        {/* Resellers */}
        <div className="bg-black/80 p-8 rounded-2xl shadow-lg text-center border border-red-800">
          <h2 className="text-2xl font-bold mb-4 text-white">For Resellers</h2>
          <ul className="space-y-2 text-red-200">
            <li>• Promote any product</li>
            <li>• Share your unique link</li>
            <li>• Earn commission per sale</li>
            <li>• No capital needed</li>
            <li>• Daily payouts</li>
          </ul>
          <Button asChild className="mt-6">
            <Link href="/signup?role=reseller">Start Earning</Link>
          </Button>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 px-6 bg-black/90 text-center">
        <h2 className="text-3xl font-bold mb-8 text-white">How MoneyGo Works</h2>
        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          <div className="p-6 bg-black/70 rounded-xl shadow border border-red-800">
            <h3 className="text-xl font-bold mb-2 text-white">1. Watch or Upload Videos</h3>
            <p className="text-red-200">Authentic reviews, live demos, and real sellers.</p>
          </div>
          <div className="p-6 bg-black/70 rounded-xl shadow border border-red-800">
            <h3 className="text-xl font-bold mb-2 text-white">2. Buy or Promote Products</h3>
            <p className="text-red-200">Buy safely or earn as a reseller.</p>
          </div>
          <div className="p-6 bg-black/70 rounded-xl shadow border border-red-800">
            <h3 className="text-xl font-bold mb-2 text-white">3. Earn or Get Delivered</h3>
            <p className="text-red-200">Buyers get delivery. Sellers & resellers get paid.</p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-white">Why Choose MoneyGo?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            "0% listing fees",
            "Real product videos",
            "Live shopping events",
            "Built-in reseller program",
            "Advanced seller analytics",
            "Secure messaging system",
            "Fast payouts",
            "African market focused",
          ].map((feature, i) => (
            <div key={i} className="p-6 bg-black/70 rounded-xl shadow text-center font-medium border border-red-800 text-red-200">
              {feature}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-24 bg-gradient-to-r from-red-900 to-black px-6">
        <h2 className="text-3xl font-bold mb-4 text-white">Start your MoneyGo journey today</h2>
        <p className="text-lg mb-10 text-red-200">Buy, Sell, or Earn — all in one powerful platform.</p>
        <div className="flex justify-center gap-4">
          <Button asChild><Link href="/signup?role=seller">Start Selling</Link></Button>
          <Button asChild><Link href="/signup?role=reseller">Start Earning</Link></Button>
          <Button asChild variant="secondary"><Link href="/live">Browse Products</Link></Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-10 px-6 bg-black text-red-200">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center font-bold text-black">MG</div>
              <div>
                <div className="font-semibold text-white">MoneyGo</div>
                <div className="text-sm text-red-300">Empowering sellers across Africa</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-red-300 max-w-md">Built with love for creators and sellers — a platform that rewards authenticity and hustle.</p>
          </div>

          <div>
            <div className="font-semibold text-white">Product</div>
            <ul className="mt-2 text-sm space-y-2 text-red-300">
              <li>How MoneyGo Works</li>
              <li>Seller Dashboard</li>
              <li>Reseller Program</li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-white">Company</div>
            <ul className="mt-2 text-sm space-y-2 text-red-300">
              <li>About</li>
              <li>Careers</li>
              <li>Contact</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 text-sm border-t border-red-800 pt-4 max-w-6xl mx-auto text-red-300">
          <div className="flex items-center justify-between">
            <div>© {new Date().getFullYear()} MoneyGo. All rights reserved.</div>
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
              <MoneyGoHomepage />
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
