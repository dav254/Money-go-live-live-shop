'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Radio, Sparkles, Play, ShieldCheck, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const DEMO_VIDEOS = [
    {
        id: 'vid-1',
        url: 'https://cdn.pixabay.com/video/2020/09/25/50346-455431631_large.mp4',
        title: 'Premium Streetwear',
        points: '150 pts'
    },
    {
        id: 'vid-2',
        url: 'https://cdn.pixabay.com/video/2021/04/12/70860-536979607_large.mp4',
        title: 'Smart Tech Gear',
        points: '200 pts'
    },
    {
        id: 'vid-3',
        url: 'https://cdn.pixabay.com/video/2020/12/03/58269-489370857_large.mp4',
        title: 'Artisan Crafts',
        points: '120 pts'
    },
    {
        id: 'vid-4',
        url: 'https://cdn.pixabay.com/video/2023/11/13/167018-836109968_large.mp4',
        title: 'Luxury Accessories',
        points: '300 pts'
    }
];

export default function AdminVideoShowcase() {
    return (
        <div id="demos" className="py-24 relative overflow-hidden">
            <div className="container max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div className="space-y-4 text-left">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.4em] text-[10px] px-5 py-2 rounded-full">
                            Autonomous Content
                        </Badge>
                        <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-white">
                            AUTHENTIC
                            <br />
                            <span className="text-primary glow-text">MOTION</span>
                        </h2>
                    </div>
                    <p className="text-neutral-500 font-bold text-[11px] uppercase tracking-widest leading-relaxed max-w-[320px] text-left">
                        This is the GoEarn experience. Real products, real sellers, real movement. Instant conversion through immersive signal streams.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {DEMO_VIDEOS.map((video, i) => (
                        <motion.div
                            key={video.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="group relative aspect-[9/16] rounded-[3rem] overflow-hidden border-2 border-white/5 bg-neutral-900 shadow-2xl hover:border-primary/40 transition-all"
                        >
                            <video
                                src={video.url}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="h-full w-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                            />
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            
                            {/* Overlay UI */}
                            <div className="absolute top-6 left-6 z-10">
                                <Badge className="bg-red-600/90 hover:bg-red-600 border-none flex items-center gap-1.5 px-3 py-1 font-black uppercase tracking-widest text-[9px] animate-pulse">
                                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                    SIGNAL LIVE
                                </Badge>
                            </div>

                            <div className="absolute bottom-8 left-8 right-8 z-10 space-y-3">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">{video.points}</p>
                                    <h4 className="text-white font-black uppercase text-xl tracking-tighter leading-tight drop-shadow-lg">{video.title}</h4>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <div className="h-10 w-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center">
                                        <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                                    </div>
                                    <ShieldCheck className="h-5 w-5 text-white/20" />
                                </div>
                            </div>

                            {/* Hover Interaction Overlay */}
                            <div className="absolute inset-0 border-[12px] border-primary/0 group-hover:border-primary/5 transition-all duration-700 pointer-events-none rounded-[3rem]" />
                        </motion.div>
                    ))}
                </div>

                <div className="mt-16 flex justify-center gap-12">
                    {[
                        { icon: Zap, label: "0ms LATENCY" },
                        { icon: ShieldCheck, label: "VERIFIED FEED" },
                        { icon: Sparkles, label: "AI ENHANCED" }
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 opacity-40">
                            <item.icon className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
