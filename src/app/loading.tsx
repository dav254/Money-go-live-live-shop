'use client';

import React from 'react';
import { Loader2, Radio } from 'lucide-react';

/**
 * High-performance splash screen for the "Initializing Signal" state.
 */
export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
        <div className="p-6 rounded-full bg-white/5 border border-white/10 relative z-10">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="font-cyber text-xl font-black uppercase tracking-[0.3em] text-white">
          Initializing Signal
        </h2>
        <div className="flex items-center justify-center gap-3 text-neutral-500">
          <Radio className="h-3 w-3 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Encrypting Data Pipe</span>
        </div>
      </div>

      <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
      </div>
    </div>
  );
}