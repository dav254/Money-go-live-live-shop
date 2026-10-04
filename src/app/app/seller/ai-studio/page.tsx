'use client';

import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { AiStudioHome } from '@/components/ai/studio-home';

/**
 * APP SELLER — AI STUDIO (`/app/seller/ai-studio`).
 *
 * `AiStudioHome` is the same component the website mounts at
 * `/dashboard/seller/ai-studio`, so every creation tool, the points balance and
 * the generation history are one implementation. The website wraps it in its
 * own wide, full-bleed marketing shell; in the app it simply sits inside the
 * seller's own chrome, which is the point of the section having its own screen
 * for it.
 */
export default function AppSellerAiStudioPage() {
  return (
    <div className="min-h-full">
      <div className="mb-5 flex items-center gap-2.5 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF4D2E] to-[#0EA5E9]">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Create with AI
        </p>
      </div>

      <Suspense
        fallback={
          <p className="px-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
            Loading studio…
          </p>
        }
      >
        <AiStudioHome />
      </Suspense>
    </div>
  );
}