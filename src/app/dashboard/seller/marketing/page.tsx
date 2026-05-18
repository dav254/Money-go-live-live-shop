
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tag, Plus, Trash2, Ticket, Percent, Zap, Gift } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

export default function SellerMarketingPage() {
    const [coupons, setCoupons] = useState([
        { id: '1', code: 'WELCOME10', discount: '10% OFF', type: 'Percentage', status: 'active' },
        { id: '2', code: 'FREE500', discount: 'Free Shipping', type: 'Shipping', status: 'active' },
    ]);

    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="flex items-center justify-between">
                    <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Marketing & Promos</h1>
                    <Button className="font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl">
                        <Plus className="mr-2 h-4 w-4" /> Create Coupon
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-neutral-900 border-white/5 border-l-4 border-l-primary">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Zap className="h-3 w-3 text-primary" /> Flash Deal Pre-sets
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-white/50 font-medium">Quickly push deals during live shows.</p>
                            <Button variant="outline" className="w-full mt-4 border-white/10 h-10 font-bold text-[10px] uppercase">Configure Presets</Button>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-neutral-900 border-white/5 border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Gift className="h-3 w-3 text-green-500" /> Referral Bonuses
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-white/50 font-medium">Reward resellers for hitting sales goals.</p>
                            <Button variant="outline" className="w-full mt-4 border-white/10 h-10 font-bold text-[10px] uppercase">Manage Rewards</Button>
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-neutral-900 border-white/5 border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Ticket className="h-3 w-3 text-blue-500" /> Global Coupons
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-white/50 font-medium">Active discounts for your entire shop.</p>
                            <Button variant="outline" className="w-full mt-4 border-white/10 h-10 font-bold text-[10px] uppercase">Browse Library</Button>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-neutral-900 border-white/5 overflow-hidden shadow-2xl">
                    <CardHeader className="bg-white/5 p-6 border-b border-white/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Tag className="h-4 w-4 text-primary" /> Active Coupon Codes
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Codes buyers can use at checkout</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {coupons.map(coupon => (
                                <div key={coupon.id} className="flex items-center justify-between p-6 group hover:bg-white/5 transition-all">
                                    <div className="flex items-center gap-6">
                                        <div className="bg-black border border-white/10 p-3 rounded-xl shadow-inner group-hover:border-primary/50 transition-colors">
                                            <code className="text-lg font-black font-mono tracking-tighter text-white">{coupon.code}</code>
                                        </div>
                                        <div>
                                            <p className="font-black text-xs uppercase tracking-tight text-white">{coupon.discount}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{coupon.type} Discount</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge className="bg-green-600 border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">Active</Badge>
                                        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SellerLayout>
    );
}
