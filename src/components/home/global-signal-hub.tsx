'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ShieldCheck, MapPin, Zap, Rocket, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => (
        <div className="h-[500px] w-full flex items-center justify-center bg-black/20 rounded-[3rem]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    )
});

const Loader2 = ({ className }: { className?: string }) => <div className={cn("animate-spin rounded-full h-8 w-8 border-b-2 border-primary", className)} />;

const signals = [
    { city: "Nairobi", action: "New Seller Joined", icon: Rocket, color: "text-orange-500" },
    { city: "London", action: "Demo Marketplace Ping", icon: Zap, color: "text-blue-500" },
    { city: "Dubai", action: "Business Promotion Started", icon: Radio, color: "text-yellow-500" },
    { city: "Tokyo", action: "Content Creator Active", icon: Users, color: "text-green-500" },
    { city: "New York", action: "Opportunity Posted", icon: ShieldCheck, color: "text-red-500" },
];

const points = [
    { lat: -1.2921, lng: 36.8219, size: 0.1, color: "#ff6600", label: "Nairobi - Signal Active" },
    { lat: 51.5072, lng: -0.1276, size: 0.1, color: "#0099ff", label: "London - Node Online" },
    { lat: 40.7128, lng: -74.0060, size: 0.1, color: "#ef4444", label: "New York - Traffic Spike" },
    { lat: 35.6762, lng: 139.6503, size: 0.1, color: "#22c55e", label: "Tokyo - Stream Active" },
    { lat: 25.2048, lng: 55.2708, size: 0.1, color: "#ffff00", label: "Dubai - Promo Launch" },
    { lat: -33.9249, lng: 18.4241, size: 0.1, color: "#ff6600", label: "Cape Town - New Entry" },
    { lat: 6.5244, lng: 3.3792, size: 0.1, color: "#ff6600", label: "Lagos - Merchant Sync" },
];

const rings = [
    { lat: -1.2921, lng: 36.8219, maxR: 10, propagationSpeed: 3, repeatPeriod: 2000 },
    { lat: 25.2048, lng: 55.2708, maxR: 8, propagationSpeed: 2, repeatPeriod: 3000 },
    { lat: 51.5072, lng: -0.1276, maxR: 12, propagationSpeed: 1, repeatPeriod: 4000 },
];

export default function GlobalSignalHub() {
    const [activeSignalIndex, setActiveSignalIndex] = useState(0);
    const globeRef = useRef<any>();

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSignalIndex((prev) => (prev + 1) % signals.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (globeRef.current) {
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 0.5;
            globeRef.current.pointOfView({ lat: 0, lng: 20, altitude: 2.5 });
        }
    }, []);

    return (
        <div className="relative w-full bg-neutral-950/50 border border-white/5 rounded-[4rem] overflow-hidden shadow-2xl p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                {/* Left Info Panel */}
                <div className="lg:col-span-4 space-y-8 z-10">
                    <div className="space-y-4">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.3em] text-[10px] px-4 py-1.5 rounded-full">
                            Live Telemetry
                        </Badge>
                        <h2 className="font-cyber text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-white">
                            GLOBAL
                            <br />
                            <span className="text-primary">SIGNAL HUB</span>
                        </h2>
                        <p className="text-neutral-500 font-medium text-sm leading-relaxed max-w-xs">
                            Monitoring real-time marketplace opportunities across the global Content-Commerce grid.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">Active Node Stream</p>
                        <div className="h-48 overflow-hidden relative">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSignalIndex}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl space-y-4"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl bg-black/40", signals[activeSignalIndex].color)}>
                                            {React.createElement(signals[activeSignalIndex].icon, { className: "h-5 w-5" })}
                                        </div>
                                        <div>
                                            <p className="text-white font-black uppercase tracking-tighter text-lg">{signals[activeSignalIndex].city}</p>
                                            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">Marketplace Signal</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-neutral-300 leading-tight">
                                        {signals[activeSignalIndex].action} detected on the Go Earn Opportunity Radar.
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 opacity-40">
                         <div className="flex items-center gap-2">
                             <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                             <span className="text-[9px] font-black text-white uppercase tracking-widest">Active Signal</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                             <span className="text-[9px] font-black text-white uppercase tracking-widest">Node Healthy</span>
                         </div>
                    </div>
                </div>

                {/* Right Globe Panel */}
                <div className="lg:col-span-8 relative flex items-center justify-center min-h-[500px] cursor-grab active:cursor-grabbing">
                    <div className="absolute inset-0 bg-primary/5 rounded-full blur-[120px] scale-75 opacity-50" />
                    
                    <Globe
                        ref={globeRef}
                        width={700}
                        height={600}
                        backgroundColor="rgba(0,0,0,0)"
                        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
                        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                        
                        pointsData={points}
                        pointAltitude={0.1}
                        pointColor="color"
                        pointRadius={0.5}
                        pointsMerge={true}
                        
                        ringsData={rings}
                        ringColor={() => "#ff6600"}
                        ringMaxRadius="maxR"
                        ringPropagationSpeed="propagationSpeed"
                        ringRepeatPeriod="repeatPeriod"

                        atmosphereColor="hsl(var(--primary))"
                        atmosphereAltitude={0.15}
                    />
                    
                    {/* UI Decoration */}
                    <div className="absolute top-0 right-0 p-8 text-right hidden md:block">
                        <p className="font-cyber text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">Lat: -1.2921 | Lng: 36.8219</p>
                        <p className="text-[8px] font-bold text-primary uppercase mt-1">Nairobi Standard Hub</p>
                    </div>

                    <div className="absolute bottom-0 right-0 p-8 hidden md:block">
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className={cn("h-1 w-4 rounded-full bg-primary", i > 4 && "opacity-20")} />
                                ))}
                            </div>
                            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Signal Integrity: 94%</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
