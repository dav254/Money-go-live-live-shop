'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, limit, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    ClipboardCheck, 
    ShieldCheck, 
    Loader2,
    Lock,
    MessageSquare,
    ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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
                    {name ? name.charAt(0) : 'U'}
                </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase tracking-tight">
                    {name || 'Unknown User'}
                </span>
                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest leading-none">
                    {type}
                </span>
            </div>
        </div>
    );
};

const OrdersTable = ({ firestore, isAdmin }: { firestore: any; isAdmin: boolean }) => {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();

    // Query specifically for orders in 'processing' state (meaning payment is verified)
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

    const handleMessageSeller = async (sellerId: string) => {
        if (!user || !firestore) return;
        
        try {
            const chatsRef = collection(firestore, 'chats');
            const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
            const querySnapshot = await getDocs(q);
            
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => {
                if (doc.data().participantIds.includes(sellerId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                router.push(`/messages?chatWith=${sellerId}`);
            } else {
                const newChatRef = doc(collection(firestore, 'chats'));
                await setDoc(newChatRef, {
                    id: newChatRef.id,
                    participantIds: [user.uid, sellerId],
                    lastMessage: 'Admin initiated contact regarding a paid order.',
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatWith=${sellerId}`);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Communication Error', description: 'Could not open chat channel.' });
        }
    };

    return (
        <div className="rounded-[2rem] border border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="border-white/5 hover:bg-transparent">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Buyer (Payer)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Product Node</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Seller (Target)</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 text-right px-6">Verified Payment</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        [...Array(5)].map((_, i) => (
                            <TableRow key={i} className="border-white/5 h-20">
                                <TableCell className="px-6"><Skeleton className="h-10 w-32 rounded-xl" /></TableCell>
                                <TableCell className="px-6"><Skeleton className="h-10 w-48 rounded-xl" /></TableCell>
                                <TableCell className="px-6"><Skeleton className="h-10 w-32 rounded-xl" /></TableCell>
                                <TableCell className="px-6 text-right"><Skeleton className="h-8 w-20 ml-auto rounded-xl" /></TableCell>
                            </TableRow>
                        ))
                    ) : (orders && orders.length > 0) ? (
                        orders.map(order => (
                            <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors h-20 group">
                                <TableCell className="px-6"><ParticipantCell userId={order.buyerId} type="buyer" /></TableCell>
                                <TableCell className="px-6">
                                    <div className="flex flex-col text-left">
                                        <span className="font-bold text-xs text-white uppercase tracking-tight truncate max-w-[180px]">
                                            {order.productName || 'Direct Purchase'}
                                        </span>
                                        <span suppressHydrationWarning className="text-[8px] font-black text-neutral-600 uppercase tracking-tighter">
                                            NODE_{order.id.slice(-6)} • {order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, HH:mm') : 'Syncing...'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="px-6"><ParticipantCell userId={order.sellerId} type="seller" /></TableCell>
                                <TableCell className="text-right px-6">
                                    <div className="flex items-center justify-end gap-3">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-primary text-sm tracking-tighter">
                                                ${order.totalAmount.toLocaleString()}
                                            </span>
                                            <Badge className="bg-green-500/10 text-green-500 border-none text-[7px] font-black px-1.5 h-3.5 mt-1 uppercase">ESCROW ACTIVE</Badge>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="icon" 
                                            className="rounded-full h-8 w-8 border-white/10 hover:bg-primary hover:text-white transition-all"
                                            onClick={() => handleMessageSeller(order.sellerId)}
                                            title="Coordinate with Seller"
                                        >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={4} className="h-64 text-center">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <ClipboardCheck className="h-12 w-12 text-neutral-500 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Verified Payment Queue Clear</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default function AdminOrderLedgerPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const firestore = useFirestore();

    const isAdmin = React.useMemo(() => {
        if (!userProfile) return false;
        return userProfile.userRole === 'admin' || userProfile.role === 'admin';
    }, [userProfile]);

    if (isUserLoading || isProfileLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
            </AdminLayout>
        );
    }

    if (!isAdmin) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-center opacity-50 px-6">
                    <Lock className="h-12 w-12 text-neutral-500 mb-4" />
                    <h2 className="font-bold text-lg text-white">Administrative Clearance Required</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">High-density payment ledger restricted to level 2 nodes.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                            Fulfillment Ledger
                        </h1>
                        <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-1 flex items-center gap-2 text-left">
                            <ShieldCheck className="h-3 w-3 text-green-500" />
                            Verified Payments Only • Escrow Protocol Active
                        </p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 px-4 py-2 rounded-xl flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Network Sync: Active</span>
                    </div>
                </div>
                <OrdersTable firestore={firestore} isAdmin={isAdmin} />
            </div>
        </AdminLayout>
    );
}
