'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, ShieldCheck, Zap, ShoppingBag, Tag, Eye, TrendingUp, Camera, Activity, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const DEMO_ITEMS = [
    {
        id: 'item-1',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2020/09/25/50346-455431631_large.mp4',
        title: 'Cyber-Streetwear 2026',
        price: 'USD $85.00',
        badge: 'NEW DROP',
        merchant: 'VoltStyle',
    },
    {
        id: 'item-2',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
        title: 'Minimalist Tech Hub',
        price: 'USD $1,200.00',
        badge: 'TOP SELLER',
        merchant: 'SiliconHub',
    },
    {
        id: 'item-3',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2021/04/12/70860-536979607_large.mp4',
        title: 'Precision Optics V2',
        price: 'USD $450.00',
        badge: 'LIMITED',
        merchant: 'OpticFlow',
    },
    {
        id: 'item-4',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
        title: 'Premium Wellness Spa',
        price: 'USD $150.00',
        badge: 'SERVICE',
        merchant: 'ZenithLife',
    },
    {
        id: 'item-5',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2022/10/24/136279-764082260_large.mp4',
        title: 'Commissioned Portrait',
        price: 'USD $300.00',
        badge: 'ARTISAN',
        merchant: 'AuraStudio',
    },
    {
        id: 'item-6',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
        title: 'Studio Headphones X',
        price: 'USD $299.00',
        badge: 'FLIGHTS',
        merchant: 'SonicMax',
    },
    {
        id: 'item-7',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2023/10/11/184488-873420800_large.mp4',
        title: 'Artisan Coffee Roasts',
        price: 'USD $24.00',
        badge: 'DAILY PING',
        merchant: 'BeanCode',
    },
    {
        id: 'item-8',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
        title: 'Performance Runners',
        price: 'USD $110.00',
        badge: 'HOT DEAL',
        merchant: 'SwiftStride',
    },
    {
        id: 'item-9',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2020/07/28/52538-469490159_large.mp4',
        title: 'Next-Gen Mobile Pro',
        price: 'USD $999.00',
        badge: 'PRE-ORDER',
        merchant: 'TechNova',
    },
    {
        id: 'item-10',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80',
        title: 'Smart Home Hub',
        price: 'USD $199.00',
        badge: 'TRENDING',
        merchant: 'NexusHome',
    },
    {
        id: 'item-11',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2021/01/21/82264-578832049_large.mp4',
        title: 'Luxury SUV Rental',
        price: 'USD $45.00/hr',
        badge: 'ELITE RENTALS',
        merchant: 'DriveBase',
    },
    {
        id: 'item-12',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
        title: 'Custom Keyboard Build',
        price: 'USD $180.00',
        badge: 'CRAFTED',
        merchant: 'ClickClack',
    }
];

const DemoCard = ({ item, index }: { item: typeof DEMO_ITEMS[0], index: number }) => {
    const [viewers, setViewers] = useState(Math.floor(Math.random() * 500) + 100);

    useEffect(() => {
        const interval = setInterval(() => {
            setViewers(prev => Math.max(50, prev + (Math.random() > 0.5 ? 1 : -1)));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
                delay: index * 0.05, 
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1] 
            }}
            viewport={{ once: true, margin: "-50px" }}
            className="group relative aspect-[9/16] rounded-[4rem] overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl hover:border-primary/50 transition-all duration-700 hover:shadow-[0_0_60px_rgba(255,107,0,0.15)]"
        >
            {/* Media Layer */}
            {item.type === 'video' ? (
                <video
                    src={item.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-1000 scale-[1.01]"
                />
            ) : (
                <div className="h-full w-full relative">
                    <Image 
                        src={item.url} 
                        alt={item.title}
                        fill
                        className="object-cover opacity-40 group-hover:opacity-80 transition-all duration-1000 group-hover:scale-110"
                        data-ai-hint="product lifestyle photography"
                    />
                </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
            
            {/* Top HUD */}
            <div className="absolute top-8 left-8 right-8 z-10 flex justify-between items-start">
                <Badge className="bg-red-600/90 hover:bg-red-600 border-none flex items-center gap-2 px-4 py-1.5 font-black uppercase tracking-widest text-[9px] animate-pulse shadow-2xl">
                    <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                    SIGNAL LIVE
                </Badge>
                <div className="h-10 w-10 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                    <TrendingUp className="h-4 w-4 text-primary" />
                </div>
            </div>

            {/* Bottom Info Block */}
            <div className="absolute bottom-10 left-10 right-10 z-10 space-y-5">
                <div className="space-y-3">
                    <Badge variant="outline" className="text-primary border-primary/40 bg-primary/5 font-black uppercase text-[9px] tracking-[0.3em] px-3 py-1">
                        {item.badge}
                    </Badge>
                    <h4 className="text-white font-black uppercase text-2xl tracking-tighter leading-tight drop-shadow-2xl group-hover:text-primary transition-colors">
                        {item.title}
                    </h4>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary">
                            <Tag className="h-4 w-4 fill-current opacity-70" />
                            <p className="text-2xl font-black tracking-tighter glow-text leading-none">{item.price}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-60">
                            <Eye className="h-3 w-3 text-white" />
                            <span className="text-[10px] font-black text-white">{viewers}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-neutral-800 border border-white/10 overflow-hidden flex items-center justify-center group-hover:border-primary transition-colors">
                            <span className="text-[10px] font-black text-white">{item.merchant[0]}</span>
                        </div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.merchant}</span>
                    </div>
                    <div className="h-12 w-12 rounded-[1.25rem] border border-primary/20 bg-primary/10 backdrop-blur-md flex items-center justify-center hover:bg-primary transition-all group-hover:scale-110 shadow-xl group-hover:shadow-primary/40">
                        <ShoppingBag className="h-5 w-5 text-white" />
                    </div>
                </div>
            </div>

            {/* Scanner Line Animation */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_15px_rgba(255,107,0,0.6)] -translate-y-full group-hover:animate-[scan_2.5s_linear_infinite]" />
        </motion.div>
    );
};

export default function AdminVideoShowcase() {
    return (
        <div id="demos" className="py-32 relative overflow-hidden bg-black/60 border-y border-white/5">
            {/* Background Atmosphere */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[150px] rounded-full opacity-30 pointer-events-none" />

            <div className="container max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
                    <div className="space-y-6 text-left">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3"
                        >
                            <div className="h-px w-8 bg-primary/50" />
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Live Pulse</span>
                        </motion.div>
                        <h2 className="font-cyber text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none text-white">
                            AUTHENTIC
                            <br />
                            <span className="text-primary glow-text italic">MOTION</span>
                        </h2>
                    </div>
                    <div className="max-w-[400px] space-y-6">
                        <p className="text-neutral-500 font-bold text-[12px] uppercase tracking-widest leading-relaxed text-left border-l-2 border-primary/20 pl-8">
                            Experience a living marketplace. We've automated the bridge between visual storytelling and instant yield. These signals represent active global discovery across our merchant fleet.
                        </p>
                        <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-primary/60 uppercase tracking-widest">
                            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                <ShieldCheck className="h-3.5 w-3.5 text-green-500"/> Verified Assets
                            </span>
                            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                                <Activity className="h-3.5 w-3.5 text-blue-500"/> Real-time Yield
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {DEMO_ITEMS.map((item, i) => (
                        <DemoCard key={item.id} item={item} index={i} />
                    ))}
                </div>

                <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        { icon: Zap, label: "AUTONOMOUS YIELD", val: "100%" },
                        { icon: ShieldCheck, label: "TRUST INDEX", val: "AAA+" },
                        { icon: Camera, label: "SIGNAL FIDELITY", val: "4K RAW" },
                        { icon: Globe, label: "GLOBAL REACH", val: "UNLIM" }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-3 p-6 rounded-[2rem] bg-white/5 border border-white/5 group hover:border-primary/30 transition-all text-center">
                            <item.icon className="h-6 w-6 text-primary mb-1 group-hover:scale-125 transition-transform" />
                            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.5em]">{item.label}</span>
                            <span className="text-xl font-black font-cyber text-white">{item.val}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <style jsx global>{`
                @keyframes scan {
                    0% { transform: translateY(-10%); opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { transform: translateY(800%); opacity: 0; }
                }
                .glow-text {
                    text-shadow: 0 0 20px hsla(var(--primary), 0.4);
                }
            `}</style>
        </div>
    );
}

