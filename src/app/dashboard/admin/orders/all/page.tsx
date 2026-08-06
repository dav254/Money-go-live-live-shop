
'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    ClipboardCheck, 
    MessageSquare, 
    ShieldCheck, 
    User, 
    Store, 
    DollarSign, 
    ArrowRight,
    Loader2
} from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const ParticipantCell = ({ userId, type }: { userId: string; type: 'buyer' | 'seller' }) => {
    const firestore = useFirestore();
    const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
    const { data: profile, isLoading } = useDoc<UserProfile>(userRef);

    if (isLoading) return <Skeleton className="h-8 w-32 rounded-lg" />;
    if (!profile) return <span className="text-[10px] text-muted-foreground italic">Missing Profile</span>;

    const name = profile.shopName || profile.fullName || profile.username;

    return (
        <div className="flex items-center gap-2 group">
            <Avatar className="h-6 w-6 border border-white/10 group-hover:border-primary transition-all">
                <AvatarImage src={profile.profilePictureUrl} />
                <AvatarFallback className="bg-neutral-800 text-[8px] font-black uppercase">
                    {name.charAt(0)}
                </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase tracking-tight">
                    {name}
                </span>
                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest leading-none">
                    {type}
                </span>
            </div>
        </div>
    );
};

export default function AdminOrderLedgerPage() {
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    const isAdmin = userProfile?.userRole === 'admin' || userProfile?.role === 'admin';

    // Query exclusively for PAID orders (status: 'processing')
    const paidOrdersQuery = useMemoFirebase(() => {
        if (!isAdmin || !firestore) return null;
        return query(
            collection(firestore, 'orders'), 
            where('orderStatus', '==', 'processing'),
            orderBy('orderDate', 'desc'),
            limit(50)
        );
    }, [firestore, isAdmin]);

    const { data: orders, isLoading } = useCollection<Order>(paidOrdersQuery);

    return (
        <AdminLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                            Order Fulfillment Ledger
                        </h1>
                        <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-1 flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-green-500" />
                            Verified Payments Only • Awaiting Distribution
                        </p>
                    </div>
                </div>

                <div className="rounded-[2rem] border border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Buyer (Payer)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Product Node</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Seller (Target)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 text-right px-6">Verified Payment</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 text-right px-6">Coordinate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <TableRow key={i} className="border-white/5 h-20">
                                        <TableCell className="px-6"><Skeleton className="h-10 w-32 rounded-xl" /></TableCell>
                                        <TableCell className="px-6"><Skeleton className="h-10 w-48 rounded-xl" /></TableCell>
                                        <TableCell className="px-6"><Skeleton className="h-10 w-32 rounded-xl" /></TableCell>
                                        <TableCell className="px-6 text-right"><Skeleton className="h-8 w-20 ml-auto rounded-xl" /></TableCell>
                                        <TableCell className="px-6 text-right"><Skeleton className="h-10 w-10 ml-auto rounded-xl" /></TableCell>
                                    </TableRow>
                                ))
                            ) : orders && orders.length > 0 ? (
                                orders.map(order => (
                                    <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors h-20 group">
                                        <TableCell className="px-6">
                                            <ParticipantCell userId={order.buyerId} type="buyer" />
                                        </TableCell>
                                        <TableCell className="px-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-xs text-white uppercase tracking-tight truncate max-w-[180px]">
                                                    {order.productName || 'Direct Purchase'}
                                                </span>
                                                <span className="text-[8px] font-black text-neutral-600 uppercase tracking-tighter">
                                                    NODE_{order.id.slice(-6)} • {order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, HH:mm') : ''}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6">
                                            <ParticipantCell userId={order.sellerId} type="seller" />
                                        </TableCell>
                                        <TableCell className="text-right px-6">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-primary text-sm tracking-tighter">
                                                    ${order.totalAmount.toLocaleString()}
                                                </span>
                                                <Badge className="bg-green-500/10 text-green-500 border-none text-[7px] font-black px-1.5 h-3.5 mt-1 uppercase">
                                                    VERIFIED
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right px-6">
                                            <Button asChild size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-primary/5 hover:bg-primary text-primary hover:text-white transition-all">
                                                <Link href={`/messages?chatWith=${order.sellerId}`} title="Message Seller">
                                                    <MessageSquare className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center opacity-30">
                                            <ClipboardCheck className="h-12 w-12 text-neutral-500 mb-4" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">All verified payments have been distributed.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AdminLayout>
    );
}
