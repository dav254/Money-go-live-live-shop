
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Video, Users, ShoppingBag, Clock, BarChart2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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

  return (
    <SellerLayout>
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight uppercase">Broadcast History</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-neutral-900 border-white/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Shows</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black">{sessions?.length || 0}</div>
                </CardContent>
            </Card>
            <Card className="bg-neutral-900 border-white/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Peak Concurrent</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black">
                        {Math.max(...(sessions?.map(s => s.viewerCount || 0) || [0])).toLocaleString()}
                    </div>
                </CardContent>
            </Card>
             <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary">Live Conversion</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black text-primary">--</div>
                </CardContent>
            </Card>
        </div>

        <Card className="bg-neutral-900 border-white/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary" /> Past Sessions</CardTitle>
                <CardDescription>Detailed breakdown of your previous live streams.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/5">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest">Show Title</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Viewers</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Duration</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Ended At</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <TableRow key={i} className="border-white/5">
                                    <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : sessions && sessions.length > 0 ? (
                            sessions.map(session => {
                                const duration = session.startTime && session.endTime 
                                    ? Math.floor((session.endTime.toMillis() - session.startTime.toMillis()) / 60000)
                                    : 0;

                                return (
                                    <TableRow key={session.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                        <TableCell className="font-bold text-white uppercase tracking-tight py-4">
                                            {session.title || 'Untitled Show'}
                                        </TableCell>
                                        <TableCell className="text-center font-black">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Users className="h-3 w-3 text-primary" />
                                                {session.viewerCount || 0}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-muted-foreground">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Clock className="h-3 w-3" />
                                                {duration} min
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-medium text-neutral-500">
                                            {session.endTime?.toDate ? format(session.endTime.toDate(), 'PP p') : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center">
                                    <div className="flex flex-col items-center justify-center opacity-20">
                                        <Video className="h-10 w-10 mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No history recorded yet</p>
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
