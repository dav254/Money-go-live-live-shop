'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Video, Users, ShoppingBag, Clock, BarChart2, DollarSign, TrendingUp, BrainCircuit, Sparkles, Zap, ArrowUpRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Mock Data for Frontend-Only Demo
const MOCK_SESSIONS = [
  {
    id: 'stream_001',
    title: 'SUMMER VIBES: 40% OFF ALL HANDBAGS',
    viewerCount: 1240,
    sales: 1450.50,
    startTime: { toMillis: () => Date.now() - 86400000 * 2, toDate: () => new Date(Date.now() - 86400000 * 2) },
    endTime: { toMillis: () => Date.now() - 86400000 * 2 + 3600000, toDate: () => new Date(Date.now() - 86400000 * 2 + 3600000) },
    status: 'ended'
  },
  {
    id: 'stream_002',
    title: 'NEW ARRIVALS - TECH & GADGETS',
    viewerCount: 850,
    sales: 2100.00,
    startTime: { toMillis: () => Date.now() - 86400000 * 5, toDate: () => new Date(Date.now() - 86400000 * 5) },
    endTime: { toMillis: () => Date.now() - 86400000 * 5 + 2700000, toDate: () => new Date(Date.now() - 86400000 * 5 + 2700000) },
    status: 'ended'
  },
  {
    id: 'stream_003',
    title: 'FLASH SALE: HOME DECOR UNDER $50',
    viewerCount: 3200,
    sales: 450.00,
    startTime: { toMillis: () => Date.now() - 86400000 * 10, toDate: () => new Date(Date.now() - 86400000 * 10) },
    endTime: { toMillis: () => Date.now() - 86400000 * 10 + 7200000, toDate: () => new Date(Date.now() - 86400000 * 10 + 7200000) },
    status: 'ended'
  }
];

const StatCard = ({ title, value, icon: Icon, color, isLoading }: { title: string, value: string, icon: React.ElementType, color?: string, isLoading: boolean }) => (
    <Card className="bg-neutral-900 border-white/5 relative overflow-hidden group transition-all hover:border-primary/20">
        <div className={cn("absolute top-0 left-0 w-1 h-full", color || "bg-primary")} />
        <CardHeader className="pb-1">
            <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Icon className="h-3 w-3" /> {title}
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className={cn("text-2xl font-black", color === "bg-green-500" ? "text-green-500" : "text-white")}>
                {isLoading ? <Skeleton className="h-8 w-16 bg-white/5"/> : value}
            </div>
        </CardContent>
    </Card>
);

export default function SellerLiveHistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const sessions = MOCK_SESSIONS;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const stats = React.useMemo(() => {
    const totalRevenue = sessions.reduce((acc, s) => acc + (s.sales || 0), 0);
    const totalViewers = sessions.reduce((acc, s) => acc + (s.viewerCount || 0), 0);
    const peakViewers = Math.max(...(sessions.map(s => s.viewerCount || 0)), 0);
    
    const totalDuration = sessions.reduce((acc, s) => {
        return acc + (s.endTime.toMillis() - s.startTime.toMillis());
    }, 0);
    const avgDuration = sessions.length > 0 ? Math.floor(totalDuration / sessions.length / 60000) : 0; 
    const avgConversion = totalViewers > 0 ? (sessions.reduce((acc, s) => acc + (s.sales ? 1 : 0), 0) / sessions.length) * 100 : 0;

    return { totalRevenue, avgConversion, peakViewers, avgDuration };
  }, [sessions]);

  const aiInsights = React.useMemo(() => {
    const insights = [];
    if (stats.avgDuration > 60) insights.push("Shows longer than 60m are seeing a 15% drop in retention. Try 45m sessions.");
    if (stats.peakViewers > 0) insights.push(`Your peak audience of ${stats.peakViewers.toLocaleString()} occurred during your morning shows. Shift focus there.`);
    if (stats.totalRevenue > 500) insights.push("Flash sales for items under $100 are converting 3x faster than high-ticket items.");
    return insights;
  }, [stats]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
                <h1 className="font-headline text-3xl font-black tracking-tighter uppercase text-white">Broadcast History</h1>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Real-time simulation of your signal performance.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-right-4 duration-1000">
                <TrendingUp className="h-3 w-3" />
                +18.4% performance boost
            </div>
        </div>

        {/* Go-AI Smart Insights Section */}
        <Card className="bg-primary/5 border-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BrainCircuit className="h-24 w-24 text-primary" />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-pulse" /> Go-AI Smart Analysis
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Automated performance auditing</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 mt-2">
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full bg-white/5 rounded-xl" />
                            <Skeleton className="h-10 w-full bg-white/5 rounded-xl opacity-50" />
                        </div>
                    ) : (
                        aiInsights.map((insight, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                                <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
                                    <Zap className="h-3 w-3 text-primary" />
                                </div>
                                <p className="text-xs font-medium text-white/80 leading-relaxed">{insight}</p>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Shows" value={sessions.length.toString()} icon={Video} isLoading={isLoading} />
            <StatCard title="Peak Audience" value={stats.peakViewers.toLocaleString()} icon={Users} color="bg-blue-500" isLoading={isLoading} />
            <StatCard title="Live Revenue" value={`$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={DollarSign} color="bg-green-500" isLoading={isLoading} />
            <StatCard title="Avg Conversion" value={`${stats.avgConversion.toFixed(1)}%`} icon={TrendingUp} color="bg-orange-500" isLoading={isLoading} />
        </div>

        <Card className="bg-neutral-950 border-white/5 overflow-hidden shadow-2xl rounded-[2rem]">
            <CardHeader className="bg-white/5 p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        <BarChart2 className="h-4 w-4 text-primary" /> Session Ledger
                    </CardTitle>
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10 text-white/40">Demo Mode Active</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 px-6 text-white/50">Broadcaster Title</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center text-white/50">Audience</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center text-white/50">Uptime</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center text-white/50">Revenue</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-right px-6 text-white/50">Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i} className="border-white/5">
                                    <TableCell colSpan={5} className="px-6 py-6"><Skeleton className="h-8 w-full rounded-xl bg-white/5" /></TableCell>
                                </TableRow>
                            ))
                        ) : (
                            sessions.map(session => {
                                const duration = Math.floor((session.endTime.toMillis() - session.startTime.toMillis()) / 60000);

                                return (
                                    <TableRow key={session.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                        <TableCell className="font-bold text-white uppercase tracking-tight py-6 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs group-hover:text-primary transition-colors truncate max-w-[200px] md:max-w-[400px]">{session.title}</span>
                                                <span className="text-[8px] font-mono text-muted-foreground mt-1">SGN-ID: {session.id}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 font-black">
                                                <Users className="h-3 w-3 text-primary" />
                                                <span className="text-xs">{(session.viewerCount || 0).toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-muted-foreground">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Clock className="h-3 w-3 opacity-50" />
                                                <span className="text-xs">{duration}m</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="text-[10px] font-black text-green-500">$</span>
                                                <span className="text-xs font-black text-white">{(session.sales || 0).toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-6">
                                            {format(session.endTime.toDate(), 'MMM d • HH:mm')}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[10px] font-black uppercase text-neutral-600 tracking-[0.3em]">Hardware Ready</p>
            <Button asChild className="mt-6 font-black uppercase tracking-widest text-xs h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20">
                <Link href="/dashboard/seller/go-live">Initialize New Signal <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
        </div>
      </div>
    </SellerLayout>
  );
}
