'use client';

import { Loader2 } from 'lucide-react';

export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      <div className="relative mb-6">
        {/* Outer Glow Ring */}
        <div className="absolute inset-[-20px] bg-red-600/20 rounded-full animate-pulse blur-xl" />
        
        {/* Inner Ping Effect */}
        <div className="absolute inset-0 bg-red-600/30 rounded-full animate-ping" />
        
        {/* Central Spinner */}
        <Loader2 className="h-12 w-12 animate-spin text-red-600 relative z-10" />
      </div>
      
      <div className="text-center space-y-2">
        <h2 className="font-cyber text-sm font-black uppercase tracking-[0.5em] text-red-600 animate-pulse">
          Synchronizing
        </h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Fetching Marketplace Signal...
        </p>
      </div>
    </div>
  );
}