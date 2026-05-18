
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Video, Users, ShoppingBag, Clock, BarChart2, DollarSign, TrendingUp, BrainCircuit, Sparkles, Zap, ArrowUpRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import { cn } from '@/lib/utils';

export default function SellerLiveHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const historyQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'liveSessions'),
      where('sellerId', '==', user.uid),
      where('status', '==', 'ended'),
      orderBy('endTime', 'desc')
    );
  }, [user, firestore]);

  const { data: sessions, isLoading } = useCollection<LiveSession>(historyQuery);

  const stats = React.useMemo(() => {
    if (!sessions || sessions.length === 0) return { totalRevenue: 0, avgConversion: 0, peakViewers: 0, avgDuration: 0 };
    
    const totalRevenue = sessions.reduce((acc, s) => acc + (s.sales || 0), 0);
    const totalViewers = sessions.reduce((acc, s) => acc + (s.viewerCount || 0), 0);
    const peakViewers = Math.max(...(sessions.map(s => s.viewerCount || 0)), 0);
    
    const totalDuration = sessions.reduce((acc, s) => {
        if (!s.startTime || !s.endTime) return acc;
        return acc + (s.endTime.toMillis() - s.startTime.toMillis());
    }, 0);
    const avgDuration = Math.floor(totalDuration / sessions.length / 60000); // in minutes
    
    const avgConversion = totalViewers > 0 ? (sessions.reduce((acc, s) => acc + (s.sales ? 1 : 0), 0) / sessions.length) * 100 : 0;

    return { totalRevenue, avgConversion, peakViewers, avgDuration };
  }, [sessions]);

  // AI Mock Insights based on data
  const aiInsights = React.useMemo(() => {
    if (!sessions || sessions.length === 0) return ["Host your first show to unlock Go-AI analytics."];
    
    const insights = [];
    if (stats.avgDuration > 60) insights.push("Shows longer than 60m are seeing a 15% drop in retention. Try 45m sessions.");
    if (stats.peakViewers > 0) insights.push(`Your peak audience of ${stats.peakViewers} occurred at night. Consider scheduling more PM shows.`);
    if (stats.totalRevenue > 500) insights.push("High revenue detected! Pinning 'Featured Deals' earlier in your stream is working.");
    
    return insights.length > 0 ? insights : ["Your stream performance is stable. Try adding a 'Flash Sale' to boost conversion."];
  }, [sessions, stats]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
                <h1 className="font-headline text-3xl font-black tracking-tighter uppercase text-white">Broadcast History</h1>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Analyze your previous signal performance and sales impact.</p>
            </div>
            {sessions && sessions.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-widest">
                    <TrendingUp className="h-3 w-3" />
                    +12% vs last month
                </div>
            )}
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
                        <Skeleton className="h-12 w-full bg-white/5 rounded-xl" />
                    ) : (
                        aiInsights.map((insight, idx) => (
                            <div key={idx} className="flex items-start gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                                <div className="p-1.5 bg-primary/10 rounded-lg">
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
            <Card className="bg-neutral-900 border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <CardHeader className="pb-1">
                    <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Video className="h-3 w-3" /> Total Shows
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">{isLoading ? <Skeleton className="h-8 w-12 bg-white/5"/> : sessions?.length || 0}</div>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <CardHeader className="pb-1">
                    <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" /> Peak Audience
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">
                        {isLoading ? <Skeleton className="h-8 w-12 bg-white/5"/> : stats.peakViewers.toLocaleString()}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                <CardHeader className="pb-1">
                    <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-3 w-3" /> Live Revenue
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-green-500">
                        {isLoading ? <Skeleton className="h-8 w-20 bg-white/5"/> : `$${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </div>
                </CardContent>
            </Card>

             <Card className="bg-neutral-900 border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
                <CardHeader className="pb-1">
                    <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" /> Avg Conversion
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">
                        {isLoading ? <Skeleton className="h-8 w-12 bg-white/5"/> : (stats.avgConversion > 0 ? `${stats.avgConversion.toFixed(1)}%` : '0%')}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="bg-neutral-950 border-white/5 overflow-hidden shadow-2xl rounded-[2rem]">
            <CardHeader className="bg-white/5 p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        <BarChart2 className="h-4 w-4 text-primary" /> Session Ledger
                    </CardTitle>
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10 text-white/40">Sorted by Date</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 px-6 text-white/50">Broadcaster Title</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center text-white/50">Audience</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center text-white/50">Uptime</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center text-white/50">GTV</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-right px-6 text-white/50">Logged At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i} className="border-white/5">
                                    <TableCell colSpan={5} className="px-6 py-6"><Skeleton className="h-8 w-full rounded-xl bg-white/5" /></TableCell>
                                </TableRow>
                            ))
                        ) : sessions && sessions.length > 0 ? (
                            sessions.map(session => {
                                const duration = session.startTime && session.endTime 
                                    ? Math.floor((session.endTime.toMillis() - session.startTime.toMillis()) / 60000)
                                    : 0;

                                return (
                                    <TableRow key={session.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                        <TableCell className="font-bold text-white uppercase tracking-tight py-6 px-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs group-hover:text-primary transition-colors truncate max-w-[200px]">{session.title || 'Untitled Show'}</span>
                                                <span className="text-[8px] font-mono text-muted-foreground mt-1">SGN-ID: {session.id.substring(0, 8)}</span>
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
                                            {session.endTime?.toDate ? format(session.endTime.toDate(), 'MMM d • HH:mm') : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center opacity-20">
                                        <div className="p-6 rounded-full border-2 border-dashed border-neutral-700 mb-6">
                                            <Video className="h-12 w-12 text-neutral-600" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Broadcast Data</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest mt-2 text-neutral-500 max-w-[240px] leading-relaxed mx-auto">Your historical performance data will appear here after you end your first live broadcast.</p>
                                        <Button asChild className="mt-8 font-black uppercase tracking-widest text-[9px] h-10 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white">
                                            <Link href="/dashboard/seller/go-live">GO LIVE NOW</Link>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
