
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { formatDistanceToNow } from 'date-fns';
import { ShieldAlert, Video } from 'lucide-react';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Complaint, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const SellerCell = ({ sellerId }: { sellerId: string }) => {
    const firestore = useFirestore();
    const sellerProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [firestore, sellerId]);
    const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);

    if (isLoading) return <Skeleton className="h-6 w-24" />;

    return (
        <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={seller?.profilePictureUrl} />
          <AvatarFallback>{seller?.fullName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="font-medium">{seller?.fullName}</div>
      </div>
    );
};


const reasonVariant: { [key: string]: 'destructive' | 'secondary' | 'default' } = {
  'Inappropriate Content': 'destructive',
  'Scam/Fraud': 'destructive',
  'Hate Speech': 'destructive',
};

const columns: ColumnDef<Complaint>[] = [
  {
    accessorKey: 'targetId',
    header: 'Seller',
    cell: ({ row }) => <SellerCell sellerId={row.original.targetId} />,
  },
  {
    accessorKey: 'reason',
    header: 'Reason for Flag',
    cell: ({ row }) => {
        const reason = row.original.reason;
        return <Badge variant={reasonVariant[reason as keyof typeof reasonVariant] || 'default'}>{reason}</Badge>
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'Time',
    cell: ({ row }) => formatDistanceToNow(row.original.createdAt.toDate(), { addSuffix: true }),
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const stream = row.original;
      return (
        <div className="text-right">
            <Button variant="outline" size="sm" className="mr-2">
                <Video className="mr-2 h-4 w-4" />
                Review Stream
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <DotsHorizontalIcon className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem>View Seller Profile</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-yellow-600">Warn Seller</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Suspend Seller</DropdownMenuItem>
                 <DropdownMenuItem>Dismiss Flag</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      );
    },
  },
];

export default function AdminFlaggedStreamsPage() {
  const firestore = useFirestore();

  // Querying complaints collection for reports against users, which we'll treat as flagged streams for now.
  // A more robust system would have a dedicated 'flags' collection for streams.
  const flaggedQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'complaints'), where('targetType', '==', 'user'));
  }, [firestore]);

  const { data: flaggedItems, isLoading } = useCollection<Complaint>(flaggedQuery);


  const table = useReactTable({
      data: flaggedItems || [],
      columns,
      getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          Flagged Streams Queue
        </h1>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                        {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                            )}
                        </TableHead>
                    ))}
                    </TableRow>
                ))}
                </TableHeader>
                <TableBody>
                {isLoading ? (
                  [...Array(2)].map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((col, j) => (
                        <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                            {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                            )}
                        </TableCell>
                        ))}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        The moderation queue is clear. No flagged streams.
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
