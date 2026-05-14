
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Clock, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface LivePromoOverlayProps {
    offer: {
        title: string;
        code: string;
        discountValue: string;
        expiresAt: any;
    };
}

export function LivePromoOverlay({ offer }: LivePromoOverlayProps) {
    const { toast } = useToast();
    const [timeLeft, setTimeLeft] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const calculateTime = () => {
            if (!offer.expiresAt) return;
            const now = Date.now();
            const expires = offer.expiresAt.toMillis();
            const diff = expires - now;

            if (diff <= 0) {
                setTimeLeft('EXPIRED');
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
        };

        const timer = setInterval(calculateTime, 1000);
        calculateTime();
        return () => clearInterval(timer);
    }, [offer.expiresAt]);

    const handleCopy = () => {
        navigator.clipboard.writeText(offer.code);
        setCopied(true);
        toast({ title: 'Code Copied!', description: 'Use it at checkout for your discount.' });
        setTimeout(() => setCopied(false), 3000);
    };

    if (timeLeft === 'EXPIRED') return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-yellow-500/10 backdrop-blur-3xl border border-yellow-500/40 rounded-3xl p-4 shadow-[0_0_50px_rgba(234,179,8,0.15)] flex flex-col gap-4 ring-1 ring-white/10"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em]">LIVE OFFER</span>
                </div>
                <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                    <Clock className="h-3 w-3 text-white/70" />
                    <span className="text-[10px] font-black text-white font-mono">{timeLeft}</span>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-black uppercase text-base tracking-tighter leading-none">{offer.title}</h4>
                    <p className="text-yellow-500 text-2xl font-black tracking-tighter mt-1">{offer.discountValue}</p>
                </div>

                <Button 
                    onClick={handleCopy}
                    className={cn(
                        "h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all",
                        copied ? "bg-green-600 text-white" : "bg-white text-black hover:bg-neutral-200"
                    )}
                >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'COPIED' : offer.code}
                </Button>
            </div>
        </motion.div>
    );
}
