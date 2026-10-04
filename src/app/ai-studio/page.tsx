'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Loader2 } from 'lucide-react';
import { useUser, useUserProfile } from '@/firebase';
import { MainLayout } from '@/components/layout/main-layout';
import { AiStudioHome } from '@/components/ai/studio-home';

/**
 * AI Studio for every signed-in role (spec §14, §23).
 *
 * Sellers are sent to their workspace copy (`/dashboard/seller/ai-studio`,
 * with the merchant sidebar); buyers and customers use this page so they can
 * create an AI concept and attach it to a Request.
 */
export default function AiStudioPage() {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();
  const sentToWorkspace = React.useRef(false);

  const role = userProfile?.userRole ?? userProfile?.role;

  React.useEffect(() => {
    if (role !== 'seller' || sentToWorkspace.current) return;
    sentToWorkspace.current = true;
    router.replace('/dashboard/seller/ai-studio');
  }, [role, router]);

  if (isUserLoading || isProfileLoading) {
    return (
      <MainLayout>
        <div className="flex h-screen w-full items-center justify-center bg-ember-navy">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-ember-navy text-center">
          <p className="text-sm text-white/60">Sign in to open AI Studio.</p>
          <Link href="/login?returnTo=/ai-studio" className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white">
            Go to login
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (role === 'seller') {
    return (
      <MainLayout>
        <div className="flex h-screen w-full items-center justify-center bg-ember-navy">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-ember-navy text-white">
        <div className="border-b border-white/10 bg-black/20">
          <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Studio
            </Link>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Create · Save · Use</span>
          </div>
        </div>
        <main className="container mx-auto max-w-6xl px-4 py-12 md:py-16 vn-page-enter">
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.4em] text-white/40">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Create with AI
          </p>
          <h1 className="vn-display mt-6 text-5xl md:text-7xl">
            What do you<br />
            <span className="vn-text-grad">want to create?</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/50">
            Create an image or video concept and attach it to your request so businesses can see exactly
            what you have in mind.
          </p>
          <div className="mt-12">
            <AiStudioHome />
          </div>
        </main>
      </div>
    </MainLayout>
  );
}