'use client';

import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { AiStudioHome } from '@/components/ai/studio-home';

const PHASES = ['CREATING', 'ANALYZING', 'GENERATING', 'PROCESSING', 'READY'];

/**
 * VIDNOV AI STUDIO — seller workspace edition.
 *
 * The studio home holds every creation tool (spec §1): text→video,
 * image→video, text→image, image→image, My Creations, Generation History
 * and the AI Points balance. Generation runs through the Vidnov AI Gateway,
 * so swapping Wan2.1 for another model never changes this page.
 */
export default function SellerAiStudioPage() {
  return (
    <SellerLayout fullWidth>
      <div className="h-full min-h-full overflow-y-auto overflow-x-hidden bg-ember-navy text-white">
        {/* studio strip */}
        <div className="border-b border-white/10 bg-black/20">
          <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">AI Studio</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Seller workspace</span>
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
            Create images and videos for your business, listings, requests, promotions and social
            content. Everything saves to your Vidnov media library.
          </p>

          <div className="mt-12">
            <Suspense
              fallback={
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 animate-pulse">
                  Loading studio…
                </p>
              }
            >
              <AiStudioHome />
            </Suspense>
          </div>

          {/* phase strip */}
          <div className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/10 pt-8">
            {PHASES.map((phase, i) => (
              <span key={phase} className="flex items-center gap-2">
                <span className={`font-grotesk text-[10px] font-semibold tracking-[0.3em] ${i === 0 ? 'vn-text-grad' : 'text-white/25'}`}>
                  {phase}
                </span>
                {i < PHASES.length - 1 && <span className="h-px w-6 bg-white/10" aria-hidden />}
              </span>
            ))}
          </div>
        </main>
      </div>
    </SellerLayout>
  );
}