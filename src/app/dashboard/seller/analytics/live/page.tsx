
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Video, Users, ShoppingBag, Clock, BarChart2, DollarSign, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import React from 'react';

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
    if (!sessions) return { totalRevenue: 0, avgConversion: 0, peakViewers: 0 };
    
    const totalRevenue = sessions.reduce((acc, s) => acc + (s.sales || 0), 0);
    const totalViewers = sessions.reduce((acc, s) => acc + (s.viewerCount || 0), 0);
    const peakViewers = Math.max(...(sessions.map(s => s.viewerCount || 0)), 0);
    
    // Simple conversion logic: Sales count relative to total viewership across shows
    // In a real scenario, this would be based on actual 'Order' documents linked to sessions
    const avgConversion = totalViewers > 0 ? (sessions.reduce((acc, s) => acc + (s.sales ? 1 : 0), 0) / sessions.length) * 100 : 0;

    return { totalRevenue, avgConversion, peakViewers };
  }, [sessions]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="font-headline text-3xl font-black tracking-tighter uppercase text-white">Broadcast History</h1>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-1">Analyze your past signal performance and sales impact.</p>
            </div>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-neutral-900 border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Video className="h-3 w-3" /> Total Shows
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">{sessions?.length || 0}</div>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" /> Peak Viewers
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-white">
                        {stats.peakViewers.toLocaleString()}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-3 w-3" /> Live Revenue
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-green-500">
                        ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </CardContent>
            </Card>

             <Card className="bg-primary/5 border-primary/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary animate-pulse" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" /> Avg Conversion
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-primary">
                        {stats.avgConversion > 0 ? `${stats.avgConversion.toFixed(1)}%` : '---'}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="bg-neutral-950 border-white/5 overflow-hidden shadow-2xl rounded-[2rem]">
            <CardHeader className="bg-white/5 p-6 border-b border-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                    <BarChart2 className="h-4 w-4 text-primary" /> Session Performance Ledger
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Detailed breakdown of your previous signal sessions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5 hover:bg-transparent">
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 px-6">Show Title</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center">Peak Aud.</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center">Duration</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-center">Revenue</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-12 text-right px-6">Timestamp</TableHead>
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
                                                <span className="text-xs group-hover:text-primary transition-colors">{session.title || 'Untitled Show'}</span>
                                                <span className="text-[8px] font-mono text-muted-foreground mt-0.5">ID: {session.id.substring(0, 8)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-black">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Users className="h-3 w-3 text-primary" />
                                                <span className="text-xs">{(session.viewerCount || 0).toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-muted-foreground">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                <span className="text-xs">{duration}m</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-black text-green-500 border-green-500/20 bg-green-500/5 px-3 py-1">
                                                ${(session.sales || 0).toLocaleString()}
                                            </Badge>
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
                                        <div className="p-6 rounded-full border-2 border-dashed border-neutral-700 mb-4">
                                            <Video className="h-12 w-12 text-neutral-600" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">The Signal History is Empty</p>
                                        <p className="text-[9px] font-bold uppercase tracking-widest mt-2 text-neutral-500">Host your first show to populate the ledger</p>
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
