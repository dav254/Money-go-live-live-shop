'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
    Package, 
    MessageSquare, 
    MoreVertical, 
    ShieldCheck, 
    Truck, 
    Loader2, 
    ExternalLink,
    CheckCircle2
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, doc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

const OrderRow = ({ order }: { order: Order }) => {
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();

    const handleMessageUser = async (targetUserId: string) => {
        if (!user || !firestore) return;
        
        const chatsRef = collection(firestore, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
        
        try {
            const querySnapshot = await getDocs(q);
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.participantIds.includes(targetUserId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                router.push(`/messages?chatWith=${targetUserId}`);
            } else {
                const newChatRef = doc(collection(firestore, 'chats'));
                await setDoc(newChatRef, {
                    id: newChatRef.id,
                    participantIds: [user.uid, targetUserId],
                    lastMessage: `Regarding Order #${order.id.substring(0, 8)}`,
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatWith=${targetUserId}`);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not open chat.' });
        }
    };

    return (
        <TableRow className="border-white/5 h-20 hover:bg-white/5 transition-colors">
            <TableCell className="px-6">
                <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 rounded-xl overflow-hidden border border-white/10 bg-black shrink-0">
                        <Image src={order.productImage || 'https://placehold.co/100/000/FFF?text=P'} alt="p" fill className="object-cover" />
                    </div>
                    <div>
                        <p className="font-black text-xs uppercase text-white truncate max-w-[200px]">{order.productName}</p>
                        <p className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">#{order.id.substring(0, 8)}</p>
                    </div>
                </div>
            </TableCell>
            <TableCell className="font-black text-primary text-sm">${order.totalAmount.toLocaleString()}</TableCell>
            <TableCell className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">
                {order.orderDate?.toDate ? format(order.orderDate.toDate(), 'MMM d, yyyy') : 'N/A'}
            </TableCell>
            <TableCell>
                <Badge className="bg-green-600 font-black text-[9px] uppercase tracking-widest px-2 py-0.5 border-none">
                    {order.orderStatus === 'processing' ? 'PAID' : order.orderStatus}
                </Badge>
            </TableCell>
            <TableCell className="text-right px-6">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/10 text-neutral-500">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-2xl border-white/10 bg-neutral-950">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Admin Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleMessageUser(order.sellerId)} className="font-bold text-xs uppercase cursor-pointer">
                            <MessageSquare className="mr-2 h-3.5 w-3.5 text-primary" /> Message Seller
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMessageUser(order.buyerId)} className="font-bold text-xs uppercase cursor-pointer">
                            <MessageSquare className="mr-2 h-3.5 w-3.5 text-blue-500" /> Message Buyer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/5" />
                        <DropdownMenuItem asChild className="font-bold text-xs uppercase cursor-pointer">
                            <Link href={`/dashboard/admin/finance/payments?orderId=${order.id}`}>
                                <ShieldCheck className="mr-2 h-3.5 w-3.5 text-green-500" /> Verify Payment
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
};

export default function AdminAllOrdersPage() {
    const firestore = useFirestore();

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'orders'),
            where('orderStatus', '==', 'processing'),
            orderBy('orderDate', 'desc')
        );
    }, [firestore]);

    const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

    return (
        <AdminLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white leading-none">
                            Fulfillment Queue
                        </h1>
                        <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-2 flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-green-500" /> 
                            Verified Paid Orders Awaiting Coordination
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full rounded-3xl" />
                        <Skeleton className="h-20 w-full rounded-3xl" />
                    </div>
                ) : orders && orders.length > 0 ? (
                    <div className="rounded-[2.5rem] border border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow className="border-white/5 hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Verified Order</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14">Yield</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14">Timestamp</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14">Protocol Status</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">Network Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.map(order => <OrderRow key={order.id} order={order} />)}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex h-96 flex-col items-center justify-center gap-6 text-center rounded-[3rem] border border-dashed border-white/10 bg-neutral-900/20">
                        <div className="p-6 rounded-full bg-white/5 border border-white/10">
                            <CheckCircle2 className="h-12 w-12 text-neutral-800" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-black uppercase tracking-tighter text-white/40">Queue Clear</h2>
                            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed">No new verified payments requiring coordination at this time.</p>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}