'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Users } from 'lucide-react';

const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex flex-col items-center justify-center bg-muted/5 rounded-[3rem]">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-4">Establishing Grid Connection...</p>
        </div>
    )
});

const points = [
    { lat: -1.2921, lng: 36.8219, size: 0.25, color: "#ff0000", label: "Nairobi Core" }, 
    { lat: 6.5244, lng: 3.3792, size: 0.15, color: "#ff0000", label: "Lagos Hub" }, 
    { lat: 25.2048, lng: 55.2708, size: 0.15, color: "#ff0000", label: "Dubai Node" }, 
    { lat: 51.5072, lng: -0.1276, size: 0.1, color: "#ff0000", label: "London Gateway" }, 
    { lat: 40.7128, lng: -74.0060, size: 0.1, color: "#ff0000", label: "NYC Active" }, 
    { lat: 35.6762, lng: 139.6503, size: 0.1, color: "#ff0000", label: "Tokyo Pulse" },
];

const arcs = [
    { startLat: -1.2921, startLng: 36.8219, endLat: 51.5072, endLng: -0.1276, color: ['#ff0000', '#ff0000'] },
    { startLat: -1.2921, startLng: 36.8219, endLat: 6.5244, endLng: 3.3792, color: ['#ff0000', '#ff0000'] },
    { startLat: -1.2921, startLng: 36.8219, endLat: 25.2048, endLng: 55.2708, color: ['#ff0000', '#ff0000'] },
];

export default function GlobalCreatorGlobe() {
    const globeRef = useRef<any>();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (globeRef.current && isMounted) {
            // Initiate Auto-Rotation instantly to show movement
            const controls = globeRef.current.controls();
            if (controls) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 2.4;
                controls.enableDamping = true;
            }
            // Transition to primary viewing angle
            globeRef.current.pointOfView({ lat: 5, lng: 25, altitude: 2.2 }, 1500);
        }
    }, [isMounted]);

    if (!isMounted) return <div className="h-[400px] w-full" />;

    return (
        <div className="relative w-full h-[400px] flex items-center justify-center cursor-grab active:cursor-grabbing animate-in fade-in duration-1000">
            <Globe
                ref={globeRef}
                width={700}
                height={500}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                
                pointsData={points}
                pointAltitude="size"
                pointColor="color"
                pointRadius={1.2}
                pointsMerge={true}
                
                arcsData={arcs}
                arcColor="color"
                arcDashLength={0.4}
                arcDashGap={4}
                arcDashAnimateTime={2000}
                arcStroke={0.5}

                atmosphereColor="#ff0000"
                atmosphereAltitude={0.15}
            />
            
            {/* Real-time Telemetry Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-background/80 backdrop-blur-md px-6 py-2 rounded-full border border-border/50 pointer-events-none shadow-2xl">
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Grid: ACTIVE</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Sync: GLOBAL</span>
                </div>
            </div>
        </div>
    );
}
