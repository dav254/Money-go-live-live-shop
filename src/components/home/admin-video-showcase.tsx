
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, ShoppingBag, Tag, Eye, TrendingUp, ShieldCheck, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const DEMO_POOL = [
    { title: 'Cyber-Streetwear 2026', badge: 'NEW DROP', merchant: 'VoltStyle', hint: 'cyberpunk street fashion' },
    { title: 'Minimalist Tech Hub', badge: 'TOP SELLER', merchant: 'SiliconHub', hint: 'modern clean tech setup' },
    { title: 'Precision Optics V2', badge: 'LIMITED', merchant: 'OpticFlow', hint: 'luxury designer sunglasses' },
    { title: 'Premium Wellness Spa', badge: 'SERVICE', merchant: 'ZenithLife', hint: 'luxury spa interior' },
    { title: 'Commissioned Portrait', badge: 'ARTISAN', merchant: 'AuraStudio', hint: 'modern digital art' },
    { title: 'Studio Headphones X', badge: 'FLIGHTS', merchant: 'SonicMax', hint: 'professional studio headphones' },
    { title: 'Artisan Coffee Roasts', badge: 'DAILY PING', merchant: 'BeanCode', hint: 'gourmet coffee beans' },
    { title: 'Performance Runners', badge: 'HOT DEAL', merchant: 'SwiftStride', hint: 'futuristic running shoes' },
    { title: 'Next-Gen Mobile Pro', badge: 'PRE-ORDER', merchant: 'TechNova', hint: 'luxury smartphone concept' },
    { title: 'Smart Home Hub', badge: 'TRENDING', merchant: 'NexusHome', hint: 'smart home technology' },
];

const DemoCard = ({ item, index }: { item: any, index: number }) => {
    const [viewers, setViewers] = useState(0);
    const [price, setPrice] = useState('0.00');

    useEffect(() => {
        setPrice((Math.random() * (1200 - 20) + 20).toFixed(2));
        setViewers(Math.floor(Math.random() * 800) + 50);

        const interval = setInterval(() => {
            setViewers(prev => Math.max(50, prev + (Math.random() > 0.5 ? 1 : -1)));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
                delay: index * 0.1, 
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1] 
            }}
            viewport={{ once: true }}
            className="group relative aspect-[9/16] rounded-[3rem] overflow-hidden border border-border bg-card shadow-2xl hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_40px_rgba(255,0,0,0.1)]"
        >
            <div className="h-full w-full relative">
                <Image 
                    src="/placeholder-image.svg"
                    alt={item.title}
                    fill
                    className="object-cover opacity-80 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                    data-ai-hint={item.hint}
                />
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            <div className="absolute top-6 left-6 right-6 z-10 flex justify-between items-start">
                <Badge className="bg-red-600/90 hover:bg-red-600 border-none flex items-center gap-1.5 px-3 py-1 font-black uppercase tracking-widest text-[8px] animate-pulse">
                    <div className="h-1 w-1 rounded-full bg-white" />
                    SIGNAL LIVE
                </Badge>
                <div className="h-8 w-8 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
                    <TrendingUp className="h-3 w-3 text-primary" />
                </div>
            </div>

            <div className="absolute bottom-8 left-8 right-8 z-10 space-y-4">
                <div className="space-y-2">
                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 font-black uppercase text-[8px] tracking-[0.2em] px-2 py-0.5">
                        {item.badge}
                    </Badge>
                    <h4 className="text-white font-black uppercase text-xl tracking-tighter leading-none group-hover:text-primary transition-colors">
                        {item.title}
                    </h4>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-primary">
                            <Tag className="h-3.5 w-3.5 fill-current opacity-70" />
                            <p className="text-xl font-black tracking-tighter leading-none">USD ${price}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-70">
                            <Eye className="h-3 w-3 text-white" />
                            <span className="text-[9px] font-black text-white">{viewers}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-white/20 border border-white/20 flex items-center justify-center">
                            <span className="text-[8px] font-black text-white">{item.merchant[0]}</span>
                        </div>
                        <span className="text-[8px] font-bold text-white/80 uppercase tracking-widest">{item.merchant}</span>
                    </div>
                    <div className="h-10 w-10 rounded-xl border border-primary/20 bg-primary/10 backdrop-blur-md flex items-center justify-center hover:bg-primary transition-all group-hover:scale-110 shadow-lg group-hover:shadow-primary/30">
                        <ShoppingBag className="h-4 w-4 text-white" />
                    </div>
                </div>
            </div>
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent -translate-y-full group-hover:animate-[scan_3s_linear_infinite]" />
        </motion.div>
    );
};

export default function AdminVideoShowcase() {
    const [displayItems, setDisplayItems] = useState<any[]>([]);

    useEffect(() => {
        const shuffled = [...DEMO_POOL].sort(() => 0.5 - Math.random());
        setDisplayItems(shuffled.slice(0, 5));
    }, []);

    return (
        <div id="demos" className="py-24 relative overflow-hidden bg-muted/30 border-y border-border">
            <div className="container max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                    <div className="space-y-4 text-left">
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3"
                        >
                            <div className="h-px w-6 bg-primary/50" />
                            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">Opportunity Discovery</span>
                        </motion.div>
                        <h2 className="font-cyber text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-foreground">
                            AUTHENTIC
                            <br />
                            <span className="text-primary italic">MOTION</span>
                        </h2>
                    </div>
                    <p className="max-w-[320px] text-muted-foreground font-bold text-[11px] uppercase tracking-widest leading-relaxed text-left border-l border-primary/20 pl-6">
                        Experience the velocity of a global video marketplace. We've automated the bridge between storytelling and yield.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    {displayItems.map((item, i) => (
                        <DemoCard key={i} item={item} index={i} />
                    ))}
                </div>

                <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                        { label: "AUTONOMOUS YIELD", val: "LIVE" },
                        { label: "TRUST INDEX", val: "VERIFIED" },
                        { label: "SIGNAL FIDELITY", val: "ULTRA" },
                        { label: "GLOBAL REACH", val: "∞" }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 p-5 rounded-[2rem] bg-card border border-border group hover:border-primary/20 transition-all text-center shadow-sm">
                            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.4em]">{item.label}</span>
                            <span className="text-lg font-black font-cyber text-foreground group-hover:text-primary transition-colors">{item.val}</span>
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
            `}</style>
        </div>
    );
}
