'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
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
import { AdminLayout } from '@/components/layout/admin-layout';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, query, orderBy, doc, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Payment, UserProfile, Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CaretSortIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerPayoutsTable } from '@/components/admin/seller-payouts-table';
import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

// Reusable Chat Functionality
const useChatRedirect = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const openChat = async (targetUserId: string) => {
        if (!user || !firestore) return;
        try {
            const chatsRef = collection(firestore, 'chats');
            const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
            const querySnapshot = await getDocs(q);
            
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => {
                if (doc.data().participantIds.includes(targetUserId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                router.push(`/messages?chatId=${existingChatId}`);
            } else {
                const newChatRef = doc(collection(firestore, 'chats'));
                await setDoc(newChatRef, {
                    id: newChatRef.id,
                    participantIds: [user.uid, targetUserId],
                    lastMessage: 'Admin initiated contact.',
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatId=${newChatRef.id}`);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not open chat.' });
        }
    };
    return openChat;
};


const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 8 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
    case 'succeeded':
      return <Badge className="bg-green-600/80 hover:bg-green-600/70">{status}</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500/80 hover:bg-yellow-500/70">{status}</Badge>;
    case 'failed':
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const UserCell = ({ userId, role = 'buyer' }: { userId: string, role?: 'buyer' | 'seller' }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  if (!user) return <span className="text-muted-foreground">Unknown User</span>;
  
  const linkPath = role === 'buyer'
    ? `/dashboard/admin/users/buyers?userId=${userId}`
    : `/dashboard/admin/users/sellers?userId=${userId}`;

  const displayName = role === 'seller' ? (user.shopName || user.fullName) : user.fullName;

  return (
    <Button variant="link" asChild className="p-0 h-auto font-medium capitalize text-base">
        <Link href={linkPath}>{displayName || 'N/A'}</Link>
    </Button>
  );
};

const ParticipantFromOrderCell = ({ orderId, role }: { orderId: string, role: 'buyer' | 'seller' }) => {
    const firestore = useFirestore();
    const orderRef = useMemoFirebase(() => doc(firestore, 'orders', orderId), [firestore, orderId]);
    const { data: order, isLoading: isOrderLoading } = useDoc<Order>(orderRef);

    const userId = role === 'buyer' ? order?.buyerId : order?.sellerId;

    if (isOrderLoading) return <Skeleton className="h-5 w-24" />;
    if (!userId) return <span className="text-muted-foreground">N/A</span>;

    return <UserCell userId={userId} role={role} />;
}

const ChatCell = ({ orderId, userId: directUserId, type }: { orderId?: string; userId?: string; type: 'buyer' | 'seller' }) => {
    const openChat = useChatRedirect();
    const firestore = useFirestore();
    const orderRef = useMemoFirebase(() => orderId ? doc(firestore, 'orders', orderId) : null, [firestore, orderId]);
    const { data: order, isLoading: isOrderLoading } = useDoc<Order>(orderRef);

    const handleClick = () => {
        let targetId = directUserId;
        if (order) {
            targetId = type === 'buyer' ? order.buyerId : order.sellerId;
        }

        if (targetId) {
            openChat(targetId);
        } else {
            // Handle case where targetId is not found
        }
    };

    if (isOrderLoading && orderId) return <Skeleton className="h-8 w-8 rounded-full" />;

    return (
        <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={handleClick} title={`Chat with ${type}`}>
            <MessageSquare className="h-4 w-4" />
        </Button>
    );
};

const columns: ColumnDef<Payment>[] = [
  {
    id: 'buyer',
    header: 'Buyer',
    cell: ({ row }) => {
        const payment = row.original;
        if (payment.transactionType === 'points-purchase' && payment.userId) {
            return <UserCell userId={payment.userId} role='buyer' />;
        }
        if (payment.orderId) {
            return <ParticipantFromOrderCell orderId={payment.orderId} role='buyer' />;
        }
        return <span className="text-muted-foreground">N/A</span>;
    }
  },
  {
    id: 'seller',
    header: 'Seller',
    cell: ({ row }) => {
        const payment = row.original;
        if (payment.orderId) {
            return <ParticipantFromOrderCell orderId={payment.orderId} role='seller' />;
        }
        return <span className="text-muted-foreground">N/A</span>;
    }
  },
  {
    id: 'chat',
    header: 'Chat',
    cell: ({ row }) => {
        const payment = row.original;
        let targetUserId = payment.userId;
        let type: 'buyer' | 'seller' = 'buyer';

        // For order-related payments, we might want to chat with either buyer or seller.
        // Here, we default to chatting with the buyer if it's a direct payment, 
        // or provide logic to decide based on order context.
        if(payment.orderId) {
            // This implementation of ChatCell will handle fetching the correct id from the order.
            // We can specify who to chat with, buyer or seller.
            // Let's add two buttons or a choice if needed, for now, one for each.
            return (
                <div className="flex gap-2">
                    <ChatCell orderId={payment.orderId} type='buyer' />
                    <ChatCell orderId={payment.orderId} type='seller' />
                </div>
            )
        }
        if(payment.userId) {
             return <ChatCell userId={payment.userId} type='buyer' />
        }
        return null;
    }
  },
  {
    accessorKey: 'transactionType',
    header: 'Transaction Type',
    cell: ({ row }) => {
      const type = row.original.transactionType;
      return <Badge variant={type === 'points-purchase' ? 'outline' : 'secondary'} className="capitalize">{type?.replace('-', ' ')}</Badge>;
    }
  },
  {
    accessorKey: 'orderId',
    header: 'Order Reference',
    cell: ({ row }) => {
        const orderId = row.original.orderId;
        if (!orderId) return <span className="text-muted-foreground">N/A</span>;
        return (
          <Button variant="link" asChild className="p-0 text-xs text-muted-foreground">
            <Link href={`/dashboard/admin/orders/all?orderId=${orderId}`}>
                #{orderId.substring(0, 8)}...
            </Link>
          </Button>
        );
    }
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Amount (USD)
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => <div className="font-medium text-right">${row.original.amount.toLocaleString()}</div>,
  },
  {
    accessorKey: 'paymentStatus',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.original.paymentStatus),
  },
  {
    accessorKey: 'paymentDate',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Date
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => {
        const date = row.original.paymentDate?.toDate();
        return date ? <div className="text-right">{date.toLocaleDateString()}</div> : 'N/A';
    },
  },
];

function BuyerPaymentsTable() {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'paymentDate', desc: true }]);
  const firestore = useFirestore();

  const paymentsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'payments'), orderBy('paymentDate', 'desc'));
  }, [firestore]);

  const { data: payments, isLoading } = useCollection<Payment>(paymentsQuery);

  const table = useReactTable({
    data: payments || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (isLoading) return <DataTableSkeleton />;

  return (
    <div className="rounded-md border">
        <Table>
        <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
                ))}
            </TableRow>
            ))}
        </TableHeader>
        <TableBody>
            {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
                </TableRow>
            ))
            ) : (
            <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                No payments found.
                </TableCell>
            </TableRow>
            )}
        </TableBody>
        </Table>
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Finance Management
        </h1>
        <Tabs defaultValue="buyer-payments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="buyer-payments">Buyer Payments</TabsTrigger>
            <TabsTrigger value="seller-payouts">Seller Payouts</TabsTrigger>
          </TabsList>
          <TabsContent value="buyer-payments">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold tracking-tight">All Buyer Payments</h2>
              <BuyerPaymentsTable />
            </div>
          </TabsContent>
          <TabsContent value="seller-payouts">
            <SellerPayoutsTable />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
