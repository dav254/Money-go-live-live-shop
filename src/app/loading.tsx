'use client';

import { Loader2 } from 'lucide-react';

/**
 * Top Loading Protocol: A non-intrusive red bar at the top of the viewport.
 * Provides feedback during server-side transitions and initial loads.
 */
export default function RootLoading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none">
      {/* High-Velocity Top Bar */}
      <div className="h-1 w-full bg-neutral-900/50 overflow-hidden">
        <div className="h-full bg-red-600 shadow-[0_0_10px_#ff0000] animate-[loading-scan_1.2s_infinite_linear]" />
      </div>
      
      {/* Subtle Sync HUD at the top right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          <Loader2 className="h-3 w-3 animate-spin text-red-600" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/70">Syncing Signal</span>
      </div>
    </div>
  );
}
