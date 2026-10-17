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
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Payout, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CaretSortIcon } from '@radix-ui/react-icons';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
                    lastMessage: 'Admin initiated contact about a payout.',
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatId=${newChatRef.id}`);
            }
        } catch (error) {
            console.error("Chat Error:", error);
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
          {Array.from({ length: 6 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 6 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const getStatusBadge = (status: 'pending' | 'processing' | 'completed' | 'failed') => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-600/80 hover:bg-green-600/70">Completed</Badge>;
    case 'processing':
      return <Badge className="bg-blue-500/80 hover:bg-blue-500/70">Processing</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500/80 hover:bg-yellow-500/70">Pending</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const SellerCell = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  if (!user) return <span className="text-muted-foreground">Unknown Seller</span>;
  
  return (
    <Button variant="link" asChild className="p-0 h-auto font-medium capitalize text-base">
      <Link href={`/dashboard/admin/users/sellers?userId=${sellerId}`}>{user?.shopName || user?.fullName || 'N/A'}</Link>
    </Button>
  );
};

const PayoutStatusControl = ({ payoutId, currentStatus }: { payoutId: string, currentStatus: Payout['status']}) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [isUpdating, setIsUpdating] = React.useState(false);

    const handleStatusChange = async (newStatus: Payout['status']) => {
        if (!firestore) return;
        setIsUpdating(true);
        try {
            const payoutRef = doc(firestore, "payouts", payoutId);
            await updateDoc(payoutRef, { 
                status: newStatus,
                processedAt: newStatus === 'completed' || newStatus === 'failed' ? new Date() : null
            });
            toast({ title: "Status Updated", description: `Payout marked as ${newStatus}.` });
        } catch (error) {
            console.error("Error updating payout status:", error);
            toast({ variant: 'destructive', title: "Update Failed", description: "Could not update the payout status." });
        }
        setIsUpdating(false);
    }

    if (isUpdating) {
        return <Skeleton className="h-8 w-28" />
    }

    return (
        <Select onValueChange={handleStatusChange} defaultValue={currentStatus}>
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Update status..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
        </Select>
    );
}

const ChatCell = ({ userId }: { userId: string }) => {
    const openChat = useChatRedirect();
    return (
        <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={() => openChat(userId)} title="Chat with seller">
            <MessageSquare className="h-4 w-4" />
        </Button>
    );
};

const columns: ColumnDef<Payout>[] = [
  {
    accessorKey: 'sellerId',
    header: 'Seller',
    cell: ({ row }) => <SellerCell sellerId={row.original.sellerId} />
  },
  {
    id: 'chat',
    header: "Chat",
    cell: ({ row }) => <ChatCell userId={row.original.sellerId} />
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Amount (USD)
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => <div className="font-medium">${row.original.amount.toLocaleString()}</div>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => getStatusBadge(row.original.status),
  },
  {
    id: 'actions',
    header: 'Update Status',
    cell: ({ row }) => <PayoutStatusControl payoutId={row.original.id} currentStatus={row.original.status} />
  },
  {
    accessorKey: 'requestedAt',
    header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Requested
            <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => {
        const date = row.original.requestedAt?.toDate();
        return date ? date.toLocaleDateString() : 'N/A';
    },
  },
];

export function SellerPayoutsTable() {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'requestedAt', desc: true }]);
  const firestore = useFirestore();

  const payoutsQuery = useMemoFirebase(() => {
    if (!firestore) return null; // Return null if firestore is not available
    return query(collection(firestore, 'payouts'), orderBy('requestedAt', 'desc'));
  }, [firestore]);

  const { data: payouts, isLoading } = useCollection<Payout>(payoutsQuery);

  const table = useReactTable({
    data: payouts || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  return (
    <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Seller Payout Requests</h2>
        {isLoading ? <DataTableSkeleton /> : (
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
                    No payout requests found.
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
        )}
    </div>
  );
}
