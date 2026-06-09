'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ShieldCheck, MapPin, Zap, Rocket, Users, Globe as GlobeIcon, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => (
        <div className="h-[600px] w-full flex flex-col items-center justify-center bg-black/20 rounded-[3rem]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Calibrating 3D Logic...</p>
        </div>
    )
});

const signals = [
    { city: "Nairobi", action: "Live Sale: $42.00", icon: Zap, color: "text-orange-500" },
    { city: "Lagos", action: "New Merchant Validated", icon: ShieldCheck, color: "text-blue-500" },
    { city: "Dubai", action: "Signal Live: Electronics Expo", icon: Radio, color: "text-yellow-500" },
    { city: "London", action: "Bulk Order Dispatched", icon: Rocket, color: "text-green-500" },
    { city: "Tokyo", action: "Content Loop Active", icon: Users, color: "text-purple-500" },
    { city: "Cape Town", action: "Merchant Payout Success", icon: Zap, color: "text-primary" },
];

const points = [
    { lat: -1.2921, lng: 36.8219, size: 0.15, color: "#ff6600", label: "Nairobi Hub" },
    { lat: 6.5244, lng: 3.3792, size: 0.15, color: "#ff6600", label: "Lagos Hub" },
    { lat: 51.5072, lng: -0.1276, size: 0.1, color: "#0099ff", label: "London Node" },
    { lat: 40.7128, lng: -74.0060, size: 0.1, color: "#ef4444", label: "New York Active" },
    { lat: 35.6762, lng: 139.6503, size: 0.1, color: "#a855f7", label: "Tokyo Sync" },
    { lat: 25.2048, lng: 55.2708, size: 0.12, color: "#eab308", label: "Dubai Core" },
    { lat: -33.9249, lng: 18.4241, size: 0.1, color: "#ff6600", label: "Cape Town Active" },
    { lat: 55.7558, lng: 37.6173, size: 0.08, color: "#ffffff", label: "Moscow Ping" },
    { lat: -23.5505, lng: -46.6333, size: 0.1, color: "#22c55e", label: "Sao Paulo Node" },
    { lat: 28.6139, lng: 77.2090, size: 0.12, color: "#f97316", label: "New Delhi Sync" },
];

const rings = [
    { lat: -1.2921, lng: 36.8219, maxR: 12, propagationSpeed: 4, repeatPeriod: 1500 },
    { lat: 6.5244, lng: 3.3792, maxR: 10, propagationSpeed: 3, repeatPeriod: 2000 },
    { lat: 25.2048, lng: 55.2708, maxR: 8, propagationSpeed: 2, repeatPeriod: 3000 },
];

export default function GlobalSignalHub() {
    const [activeSignalIndex, setActiveSignalIndex] = useState(0);
    const globeRef = useRef<any>();

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSignalIndex((prev) => (prev + 1) % signals.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (globeRef.current) {
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 0.8;
            globeRef.current.pointOfView({ lat: 5, lng: 25, altitude: 2.2 });
        }
    }, []);

    return (
        <div className="relative w-full bg-neutral-950/80 border border-white/5 rounded-[4rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] p-8 lg:p-12 backdrop-blur-3xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                {/* Left Info Panel */}
                <div className="lg:col-span-4 space-y-10 z-10">
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.4em] text-[10px] px-5 py-2 rounded-full">
                            Inter-Continental Sync
                        </Badge>
                        <h2 className="font-cyber text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white">
                            LIVE
                            <br />
                            <span className="text-primary glow-text">EARTH</span>
                        </h2>
                        <p className="text-neutral-500 font-bold text-[11px] uppercase tracking-widest leading-relaxed max-w-[280px]">
                            Visualizing the global heartbeat of autonomous social commerce.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-700">Real-time Activity Stream</p>
                        <div className="h-40 overflow-hidden relative">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSignalIndex}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.4 }}
                                    className="p-6 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl relative group"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 rounded-full" />
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-2xl bg-black/60 border border-white/5", signals[activeSignalIndex].color)}>
                                            {React.createElement(signals[activeSignalIndex].icon, { className: "h-5 w-5" })}
                                        </div>
                                        <div>
                                            <p className="text-white font-black uppercase tracking-tighter text-xl leading-none mb-1">{signals[activeSignalIndex].city}</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                                                <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{signals[activeSignalIndex].action}</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 pt-4">
                         <div className="flex flex-col gap-1">
                             <span className="text-[14px] font-black text-white font-cyber">14ms</span>
                             <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Latency</span>
                         </div>
                         <div className="flex flex-col gap-1">
                             <span className="text-[14px] font-black text-green-500 font-cyber">100%</span>
                             <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">Uptime</span>
                         </div>
                    </div>
                </div>

                {/* Right Globe Panel */}
                <div className="lg:col-span-8 relative flex items-center justify-center min-h-[600px] cursor-grab active:cursor-grabbing group">
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-[150px] scale-90 opacity-40 animate-pulse" />
                    
                    <Globe
                        ref={globeRef}
                        width={800}
                        height={600}
                        backgroundColor="rgba(0,0,0,0)"
                        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                        
                        pointsData={points}
                        pointAltitude="size"
                        pointColor="color"
                        pointRadius={0.6}
                        pointsMerge={true}
                        
                        ringsData={rings}
                        ringColor={() => "#ff6600"}
                        ringMaxRadius="maxR"
                        ringPropagationSpeed="propagationSpeed"
                        ringRepeatPeriod="repeatPeriod"

                        atmosphereColor="hsl(var(--primary))"
                        atmosphereAltitude={0.2}
                    />
                    
                    {/* Corner Telemetry */}
                    <div className="absolute top-10 right-10 text-right space-y-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <p className="font-cyber text-[10px] font-black text-white uppercase tracking-[0.3em]">GRID COORDINATES</p>
                        <p className="text-[9px] font-bold text-primary uppercase">LAT: -1.2921 | LNG: 36.8219</p>
                    </div>

                    <div className="absolute bottom-10 right-10 flex items-center gap-4 bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/5 opacity-40 group-hover:opacity-100 transition-opacity">
                        <GlobeIcon className="h-5 w-5 text-primary" />
                        <div className="text-left">
                            <p className="text-[9px] font-black text-white uppercase tracking-widest leading-none mb-1">Global Load</p>
                            <div className="flex gap-0.5">
                                {[1,2,3,4,5,6,7].map(i => <div key={i} className={cn("h-1 w-3 rounded-full bg-primary", i > 5 && "opacity-20")} />)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}