'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const Globe = dynamic(() => import('react-globe.gl'), { 
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex flex-col items-center justify-center bg-muted/10 rounded-[3rem]">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        </div>
    )
});

const points = [
    { lat: -1.2921, lng: 36.8219, size: 0.1, color: "#ff0000" }, // Nairobi
    { lat: 6.5244, lng: 3.3792, size: 0.08, color: "#ff0000" }, // Lagos
    { lat: 25.2048, lng: 55.2708, size: 0.08, color: "#ff0000" }, // Dubai
    { lat: 51.5072, lng: -0.1276, size: 0.05, color: "#ff0000" }, // London
    { lat: 40.7128, lng: -74.0060, size: 0.05, color: "#ff0000" }, // NYC
    { lat: 35.6762, lng: 139.6503, size: 0.05, color: "#ff0000" }, // Tokyo
];

export default function LightGlobe() {
    const globeRef = useRef<any>();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (globeRef.current && isMounted) {
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 1.0;
            globeRef.current.pointOfView({ lat: 5, lng: 25, altitude: 2.8 });
        }
    }, [isMounted]);

    if (!isMounted) return null;

    return (
        <div className="relative w-full h-[400px] flex items-center justify-center cursor-grab active:cursor-grabbing">
            <Globe
                ref={globeRef}
                width={500}
                height={400}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
                pointsData={points}
                pointAltitude="size"
                pointColor="color"
                pointRadius={0.8}
                pointsMerge={true}
                atmosphereColor="#ff0000"
                atmosphereAltitude={0.1}
            />
        </div>
    );
}
