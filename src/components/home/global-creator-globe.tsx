'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex flex-col items-center justify-center bg-muted/5 rounded-[3rem]">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-4">Calibrating Node Signal...</p>
        </div>
    )
});

const points = [
    { lat: -1.2921, lng: 36.8219, size: 0.15, color: "#ff0000", label: "Nairobi Core" }, 
    { lat: 6.5244, lng: 3.3792, size: 0.12, color: "#ff0000", label: "Lagos Hub" }, 
    { lat: 25.2048, lng: 55.2708, size: 0.12, color: "#ff0000", label: "Dubai Node" }, 
    { lat: 51.5072, lng: -0.1276, size: 0.1, color: "#ff0000", label: "London Gateway" }, 
    { lat: 40.7128, lng: -74.0060, size: 0.1, color: "#ff0000", label: "NYC Active" }, 
    { lat: 35.6762, lng: 139.6503, size: 0.1, color: "#ff0000", label: "Tokyo Pulse" },
];

export default function GlobalCreatorGlobe() {
    const globeRef = useRef<any>();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (globeRef.current && isMounted) {
            // Force manual initiation of controls if automatic doesn't catch
            const controls = globeRef.current.controls();
            if (controls) {
                controls.autoRotate = true;
                controls.autoRotateSpeed = 1.8;
                controls.enableDamping = true;
            }
            globeRef.current.pointOfView({ lat: 10, lng: 20, altitude: 2.5 }, 2000);
        }
    }, [isMounted]);

    if (!isMounted) return <div className="h-[400px] w-full" />;

    return (
        <div className="relative w-full h-[400px] flex items-center justify-center cursor-grab active:cursor-grabbing animate-in fade-in duration-1000">
            <Globe
                ref={globeRef}
                width={600}
                height={400}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                pointsData={points}
                pointAltitude="size"
                pointColor="color"
                pointRadius={1.2}
                pointsMerge={true}
                atmosphereColor="#ff0000"
                atmosphereAltitude={0.15}
            />
            {/* Telemetry overlay to confirm activity */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-border/50 pointer-events-none opacity-40">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Global Grid: ACTIVE</span>
            </div>
        </div>
    );
}
