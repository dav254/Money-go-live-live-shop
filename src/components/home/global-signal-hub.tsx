
'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ShieldCheck, MapPin, Zap, Rocket, Users, Globe as GlobeIcon, Loader2, Sparkles, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => (
        <div className="h-[600px] w-full flex flex-col items-center justify-center bg-muted/20 rounded-[3rem]">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Calibrating 3D Logic...</p>
        </div>
    )
});

const signals = [
    { city: "Nairobi", action: "Live Sale: $42.00", icon: Zap, color: "text-orange-500" },
    { city: "Lagos", action: "Merchant Node Validated", icon: ShieldCheck, color: "text-blue-500" },
    { city: "Dubai", action: "Signal Live: Electronics Expo", icon: Radio, color: "text-yellow-500" },
    { city: "London", action: "Bulk Order Dispatched", icon: Rocket, color: "text-green-500" },
    { city: "Tokyo", action: "AI Content Loop Active", icon: Sparkles, color: "text-purple-500" },
    { city: "Addis Ababa", action: "Artisan Network Syncing", icon: Activity, color: "text-primary" },
    { city: "Singapore", action: "Tech Logistics Locked", icon: ShieldCheck, color: "text-blue-400" },
    { city: "New York", action: "Opportunity Pipeline Open", icon: Zap, color: "text-red-500" },
    { city: "Sydney", action: "24h Signal Steady", icon: Radio, color: "text-sky-500" },
    { city: "Sao Paulo", action: "Marketplace Entry: Brazil", icon: Users, color: "text-green-400" },
];

const points = [
    { lat: -1.2921, lng: 36.8219, size: 0.25, color: "#ff6600", label: "Nairobi Hub" },
    { lat: 6.5244, lng: 3.3792, size: 0.22, color: "#ff6600", label: "Lagos Active" },
    { lat: 25.2048, lng: 55.2708, size: 0.2, color: "#eab308", label: "Dubai Core" },
    { lat: 9.0054, lng: 38.7636, size: 0.1, color: "#ff6600", label: "Addis Ping" },
    { lat: 5.6037, lng: -0.1870, size: 0.1, color: "#ff6600", label: "Accra Node" },
    { lat: 30.0444, lng: 31.2357, size: 0.12, color: "#22c55e", label: "Cairo Signal" },
    { lat: -26.2041, lng: 28.0473, size: 0.12, color: "#ff6600", label: "Joburg Active" },
    { lat: -4.3224, lng: 15.3070, size: 0.08, color: "#ff6600", label: "Kinshasa Node" },
    { lat: 33.5731, lng: -7.5898, size: 0.1, color: "#ff6600", label: "Casablanca Ping" },
    { lat: 51.5072, lng: -0.1276, size: 0.15, color: "#0099ff", label: "London node" },
    { lat: 40.7128, lng: -74.0060, size: 0.15, color: "#ef4444", label: "NYC Active" },
    { lat: 35.6762, lng: 139.6503, size: 0.15, color: "#a855f7", label: "Tokyo Sync" },
    { lat: 19.0760, lng: 72.8777, size: 0.1, color: "#f97316", label: "Mumbai Node" },
    { lat: -33.8688, lng: 151.2093, size: 0.1, color: "#0ea5e9", label: "Sydney Ping" },
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
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (globeRef.current) {
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 1.2;
            globeRef.current.pointOfView({ lat: 5, lng: 25, altitude: 2.5 });
        }
    }, []);

    return (
        <div className="relative w-full bg-card border border-border rounded-[4rem] overflow-hidden shadow-2xl p-8 lg:p-12 backdrop-blur-3xl transition-all">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                
                <div className="lg:col-span-4 space-y-10 z-10 text-left">
                    <div className="space-y-6">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.4em] text-[10px] px-5 py-2 rounded-full">
                            Inter-Continental Sync
                        </Badge>
                        <h2 className="font-cyber text-5xl md:text-6xl font-black uppercase tracking-tighter leading-none text-foreground">
                            LIVE
                            <br />
                            <span className="text-primary glow-text">EARTH</span>
                        </h2>
                        <p className="text-muted-foreground font-bold text-[11px] uppercase tracking-widest leading-relaxed max-w-[300px]">
                            Visualizing the global heartbeat of autonomous social commerce. Every node represents a merchant entry or transaction.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Real-time Activity Stream</p>
                        <div className="h-40 overflow-hidden relative">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSignalIndex}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.4 }}
                                    className="p-6 rounded-[2.5rem] bg-muted/50 border border-border backdrop-blur-xl shadow-sm relative group"
                                >
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20 rounded-full" />
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-2xl bg-background border border-border shadow-sm", signals[activeSignalIndex].color)}>
                                            {React.createElement(signals[activeSignalIndex].icon, { className: "h-5 w-5" })}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-foreground font-black uppercase tracking-tighter text-xl leading-none mb-1">{signals[activeSignalIndex].city}</p>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{signals[activeSignalIndex].action}</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex items-center gap-8 pt-4">
                         <div className="flex flex-col gap-1 text-left">
                             <span className="text-[14px] font-black text-foreground font-cyber">14ms</span>
                             <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Latency</span>
                         </div>
                         <div className="flex flex-col gap-1 text-left">
                             <span className="text-[14px] font-black text-green-600 font-cyber">100%</span>
                             <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Uptime</span>
                         </div>
                         <div className="flex flex-col gap-1 text-left">
                             <span className="text-[14px] font-black text-primary font-cyber">24+</span>
                             <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Active Nodes</span>
                         </div>
                    </div>
                </div>

                <div className="lg:col-span-8 relative flex items-center justify-center min-h-[600px] cursor-grab active:cursor-grabbing group">
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
                        pointRadius={0.7}
                        pointsMerge={true}
                        
                        ringsData={rings}
                        ringColor={() => "#ff6600"}
                        ringMaxRadius="maxR"
                        ringPropagationSpeed="propagationSpeed"
                        ringRepeatPeriod="repeatPeriod"

                        atmosphereColor="hsl(var(--primary))"
                        atmosphereAltitude={0.25}
                    />
                    
                    <div className="absolute top-10 right-10 text-right space-y-1 opacity-60">
                        <p className="font-cyber text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">GRID COORDINATES</p>
                        <p className="text-[9px] font-bold text-primary uppercase">SYNC: GLOBAL_FLEET_01</p>
                    </div>

                    <div className="absolute bottom-10 right-10 flex items-center gap-4 bg-muted/60 backdrop-blur-xl p-4 rounded-3xl border border-border opacity-60 group-hover:opacity-100 transition-opacity">
                        <GlobeIcon className="h-5 w-5 text-primary" />
                        <div className="text-left">
                            <p className="text-[9px] font-black text-foreground uppercase tracking-widest leading-none mb-1">Global Load</p>
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
