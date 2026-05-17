'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Zap, Clock, Tag, X, Flame, Loader2 } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useFirestore, useDoc } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { LiveSession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface LivePromoPanelProps {
    streamId: string;
}

const PRESETS = [
    { title: 'FLASH DISCOUNT', type: 'flash', discount: '20%', duration: 5 },
    { title: 'LIMITED TIME DEAL', type: 'limited', discount: '50%', duration: 10 },
    { title: 'HAPPY HOUR', type: 'countdown', discount: 'FREE SHIPPING', duration: 15 },
];

export function LivePromoPanel({ streamId }: LivePromoPanelProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isPushing, setIsPushing] = useState(false);
    
    const [title, setTitle] = useState('');
    const [code, setCode] = useState('');
    const [discount, setDiscount] = useState('');
    const [duration, setDuration] = useState(5);

    const sessionRef = React.useMemo(() => doc(firestore, 'liveSessions', streamId), [firestore, streamId]);
    const { data: session } = useDoc<LiveSession>(sessionRef);

    const handlePushDeal = async () => {
        if (!title || !code || !discount) {
            toast({ variant: 'destructive', title: 'Details missing', description: 'Please fill out all fields.' });
            return;
        }

        setIsPushing(true);
        const expiresAt = new Date(Date.now() + duration * 60000);

        try {
            await updateDoc(sessionRef, {
                activeOffer: {
                    type: 'flash',
                    title: title.toUpperCase(),
                    code: code.toUpperCase(),
                    discountValue: discount,
                    expiresAt: Timestamp.fromDate(expiresAt)
                }
            });
            toast({ title: 'DEAL LIVE!', description: 'Buyers can now see your promotion.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Push Failed' });
        } finally {
            setIsPushing(false);
        }
    };

    const handleClearDeal = async () => {
        try {
            await updateDoc(sessionRef, { activeOffer: null });
            toast({ title: 'Offer Cleared' });
        } catch (e) {
            console.error(e);
        }
    };

    const applyPreset = (preset: typeof PRESETS[0]) => {
        setTitle(preset.title);
        setDiscount(preset.discount);
        setDuration(preset.duration);
        setCode(`LIVE${Math.floor(Math.random() * 900) + 100}`);
    };

    return (
        <div className="flex flex-col h-full bg-black overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {session?.activeOffer ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-2xl p-4 space-y-4 animate-in fade-in zoom-in-95">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Flame className="h-4 w-4 text-yellow-500" />
                                    <p className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em]">Active Offer</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-yellow-500/20" onClick={handleClearDeal}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                            <div>
                                <p className="text-white font-black uppercase text-sm tracking-tighter">{session.activeOffer.title}</p>
                                <p className="text-yellow-500 text-lg font-black tracking-tight">{session.activeOffer.discountValue}</p>
                            </div>
                            <div className="bg-black/40 rounded-xl p-2 text-center border border-white/5">
                                <code className="text-white font-mono font-bold text-xs uppercase tracking-widest">{session.activeOffer.code}</code>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Quick Presets</p>
                            <div className="grid grid-cols-1 gap-2">
                                {PRESETS.map((p, i) => (
                                    <button
                                        key={i}
                                        onClick={() => applyPreset(p)}
                                        className="text-left p-3 rounded-xl border border-white/5 bg-neutral-900 hover:bg-neutral-800 hover:border-white/10 transition-all flex items-center justify-between group"
                                    >
                                        <div>
                                            <p className="text-[10px] font-black text-white uppercase truncate">{p.title}</p>
                                            <p className="text-[9px] font-bold text-primary uppercase">{p.discount}</p>
                                        </div>
                                        <Zap className="h-3 w-3 text-neutral-700 group-hover:text-primary transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-neutral-400">Offer Title</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="FLASH SALE" className="h-10 bg-neutral-900 border-white/10 text-xs" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-neutral-400">Discount Code</Label>
                            <Input value={code} onChange={e => setCode(e.target.value)} placeholder="DEAL20" className="h-10 bg-neutral-900 border-white/10 text-xs font-mono uppercase" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-400">Value</Label>
                                <Input value={discount} onChange={e => setDiscount(e.target.value)} placeholder="20% OFF" className="h-10 bg-neutral-900 border-white/10 text-xs" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-neutral-400">Duration (Min)</Label>
                                <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="h-10 bg-neutral-900 border-white/10 text-xs" />
                            </div>
                        </div>

                        <Button 
                            className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/20"
                            disabled={isPushing}
                            onClick={handlePushDeal}
                        >
                            {isPushing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                            PUSH DEAL TO BUYERS
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}