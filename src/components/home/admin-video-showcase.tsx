'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Radio, Sparkles, Play, ShieldCheck, Zap, ShoppingBag, Tag, Star, Camera } from 'lucide-react';
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
        merchant: 'VoltStyle'
    },
    {
        id: 'item-2',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
        title: 'Minimalist Tech Hub',
        price: 'USD $1,200.00',
        badge: 'TOP SELLER',
        merchant: 'SiliconHub'
    },
    {
        id: 'item-3',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2021/04/12/70860-536979607_large.mp4',
        title: 'Precision Optics V2',
        price: 'USD $450.00',
        badge: 'LIMITED',
        merchant: 'OpticFlow'
    },
    {
        id: 'item-4',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
        title: 'Premium Wellness Spa',
        price: 'USD $150.00',
        badge: 'SERVICE',
        merchant: 'ZenithLife'
    },
    {
        id: 'item-5',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2022/10/24/136279-764082260_large.mp4',
        title: 'Commissioned Portrait',
        price: 'USD $300.00',
        badge: 'ARTISAN',
        merchant: 'AuraStudio'
    },
    {
        id: 'item-6',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
        title: 'Studio Headphones X',
        price: 'USD $299.00',
        badge: 'FLIGHTS',
        merchant: 'SonicMax'
    },
    {
        id: 'item-7',
        type: 'video',
        url: 'https://cdn.pixabay.com/video/2023/10/11/184488-873420800_large.mp4',
        title: 'Artisan Coffee Roasts',
        price: 'USD $24.00',
        badge: 'DAILY PING',
        merchant: 'BeanCode'
    },
    {
        id: 'item-8',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
        title: 'Performance Runners',
        price: 'USD $110.00',
        badge: 'HOT DEAL',
        merchant: 'SwiftStride'
    }
];

export default function AdminVideoShowcase() {
    return (
        <div id="demos" className="py-32 relative overflow-hidden bg-black/40 border-y border-white/5">
            {/* Background Atmosphere */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/5 blur-[120px] rounded-full opacity-20 pointer-events-none" />

            <div className="container max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                    <div className="space-y-4 text-left">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 uppercase font-black tracking-[0.4em] text-[10px] px-5 py-2 rounded-full shadow-[0_0_20px_rgba(255,107,0,0.1)]">
                            Autonomous Global Feed
                        </Badge>
                        <h2 className="font-cyber text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none text-white">
                            AUTHENTIC
                            <br />
                            <span className="text-primary glow-text italic">MOTION</span>
                        </h2>
                    </div>
                    <div className="max-w-[350px] space-y-4">
                        <p className="text-neutral-500 font-bold text-[11px] uppercase tracking-widest leading-relaxed text-left border-l-2 border-primary/20 pl-6">
                            Beyond static listings. We've engineered a sensory commerce experience where products breathe and services come alive through verified 4K signal streams.
                        </p>
                        <div className="flex items-center gap-4 text-[9px] font-black text-primary/60 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3"/> Verified Inventory</span>
                            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3"/> Instant Checkout</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {DEMO_ITEMS.map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ 
                                delay: i * 0.08, 
                                duration: 0.6,
                                ease: [0.16, 1, 0.3, 1] 
                            }}
                            viewport={{ once: true, margin: "-100px" }}
                            className="group relative aspect-[9/16] rounded-[3.5rem] overflow-hidden border border-white/10 bg-neutral-900 shadow-2xl hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(255,107,0,0.1)]"
                        >
                            {/* Media Layer */}
                            {item.type === 'video' ? (
                                <video
                                    src={item.url}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    className="h-full w-full object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-700"
                                />
                            ) : (
                                <div className="h-full w-full relative">
                                    <Image 
                                        src={item.url} 
                                        alt={item.title}
                                        fill
                                        className="object-cover opacity-50 group-hover:opacity-70 transition-opacity duration-700"
                                    />
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            
                            {/* Top HUD */}
                            <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-start">
                                <Badge className="bg-red-600/90 hover:bg-red-600 border-none flex items-center gap-1.5 px-3 py-1 font-black uppercase tracking-widest text-[9px] animate-pulse shadow-lg">
                                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                    SIGNAL LIVE
                                </Badge>
                                <div className="h-8 w-8 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                </div>
                            </div>

                            {/* Bottom Info Block */}
                            <div className="absolute bottom-8 left-8 right-8 z-10 space-y-4">
                                <div className="space-y-2">
                                    <Badge variant="outline" className="text-primary border-primary/40 bg-primary/5 font-black uppercase text-[8px] tracking-[0.2em] px-2">
                                        {item.badge}
                                    </Badge>
                                    <h4 className="text-white font-black uppercase text-xl tracking-tighter leading-tight drop-shadow-2xl">
                                        {item.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-3 w-3 text-primary/60" />
                                        <p className="text-lg font-black text-primary tracking-tighter glow-text">{item.price}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-neutral-800 border border-white/10 overflow-hidden flex items-center justify-center">
                                            <span className="text-[8px] font-black">{item.merchant[0]}</span>
                                        </div>
                                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{item.merchant}</span>
                                    </div>
                                    <div className="h-10 w-10 rounded-full border border-primary/20 bg-primary/10 backdrop-blur-md flex items-center justify-center hover:bg-primary transition-all group-hover:scale-110">
                                        <ShoppingBag className="h-4 w-4 text-white" />
                                    </div>
                                </div>
                            </div>

                            {/* Scanner Line Animation */}
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent shadow-[0_0_10px_rgba(255,107,0,0.5)] -translate-y-full group-hover:animate-[scan_3s_linear_infinite]" />
                        </motion.div>
                    ))}
                </div>

                <div className="mt-20 flex flex-wrap justify-center gap-x-16 gap-y-6">
                    {[
                        { icon: Zap, label: "REAL-TIME YIELD" },
                        { icon: ShieldCheck, label: "VERIFIED MERCHANT NODES" },
                        { icon: Camera, label: "0-FILTER AUTHENTICITY" },
                        { icon: Sparkles, label: "AI LOGISTIC MAPPING" }
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 opacity-30 group hover:opacity-100 transition-opacity">
                            <item.icon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.4em]">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <style jsx global>{`
                @keyframes scan {
                    0% { transform: translateY(-10%); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(1000%); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
