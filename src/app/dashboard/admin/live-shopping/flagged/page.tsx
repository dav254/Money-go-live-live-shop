
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

type FlaggedStream = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  reason: 'Inappropriate Content' | 'Scam/Fraud' | 'Hate Speech';
  flaggedAt: Date;
  liveSessionId: string;
};

const mockData: FlaggedStream[] = [
  {
    id: 'flag-1',
    sellerId: 'seller-xyz',
    sellerName: 'Flashy Gadgets',
    sellerAvatar: 'https://picsum.photos/seed/seller1/40',
    reason: 'Scam/Fraud',
    flaggedAt: new Date(new Date().setHours(new Date().getHours() - 1)),
    liveSessionId: 'live-abc',
  },
  {
    id: 'flag-2',
    sellerId: 'seller-abc',
    sellerName: 'Trendy Threads',
    sellerAvatar: 'https://picsum.photos/seed/seller2/40',
    reason: 'Inappropriate Content',
    flaggedAt: new Date(new Date().setMinutes(new Date().getMinutes() - 15)),
    liveSessionId: 'live-def',
  },
];

const reasonVariant: { [key in FlaggedStream['reason']]: 'destructive' | 'secondary' | 'default' } = {
    'Inappropriate Content': 'destructive',
    'Scam/Fraud': 'destructive',
    'Hate Speech': 'destructive',
};

const columns: ColumnDef<FlaggedStream>[] = [
  {
    accessorKey: 'sellerName',
    header: 'Seller',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={row.original.sellerAvatar} />
          <AvatarFallback>{row.original.sellerName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="font-medium">{row.original.sellerName}</div>
      </div>
    ),
  },
  {
    accessorKey: 'reason',
    header: 'Reason for Flag',
    cell: ({ row }) => {
        const reason = row.original.reason;
        return <Badge variant={reasonVariant[reason]}>{reason}</Badge>
    }
  },
  {
    accessorKey: 'flaggedAt',
    header: 'Time',
    cell: ({ row }) => formatDistanceToNow(row.original.flaggedAt, { addSuffix: true }),
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
    const [data] = React.useState(() => [...mockData]);

    const table = useReactTable({
        data,
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
                {table.getRowModel().rows?.length ? (
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
