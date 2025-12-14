
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
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Eye, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

type ApprovedStream = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  streamTitle: string;
  approvedAt: Date;
  peakViewers: number;
  totalSales: number;
};

const mockData: ApprovedStream[] = [
  {
    id: 'stream-1',
    sellerId: 'seller-abc',
    sellerName: 'Trendy Threads',
    sellerAvatar: 'https://picsum.photos/seed/seller2/40',
    streamTitle: '🔥 Summer Collection Launch!',
    approvedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    peakViewers: 1245,
    totalSales: 2350.75,
  },
  {
    id: 'stream-2',
    sellerId: 'seller-xyz',
    sellerName: 'Flashy Gadgets',
    sellerAvatar: 'https://picsum.photos/seed/seller1/40',
    streamTitle: 'Unboxing the new TechPhone X',
    approvedAt: new Date(new Date().setDate(new Date().getDate() - 2)),
    peakViewers: 876,
    totalSales: 1890.50,
  },
   {
    id: 'stream-3',
    sellerId: 'seller-ghi',
    sellerName: 'Gourmet Kitchen',
    sellerAvatar: 'https://picsum.photos/seed/seller3/40',
    streamTitle: 'Live Cooking: Pasta from Scratch',
    approvedAt: new Date(new Date().setDate(new Date().getDate() - 3)),
    peakViewers: 450,
    totalSales: 850.00,
  },
];

const columns: ColumnDef<ApprovedStream>[] = [
  {
    accessorKey: 'streamTitle',
    header: 'Stream',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={row.original.sellerAvatar} />
          <AvatarFallback>{row.original.sellerName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
            <p className="font-medium">{row.original.streamTitle}</p>
            <p className="text-xs text-muted-foreground">{row.original.sellerName}</p>
        </div>
      </div>
    ),
  },
   {
    accessorKey: 'approvedAt',
    header: 'Date Approved',
    cell: ({ row }) => format(row.original.approvedAt, 'PPP'),
  },
  {
    accessorKey: 'peakViewers',
    header: 'Peak Viewers',
    cell: ({ row }) => row.original.peakViewers.toLocaleString(),
  },
  {
    accessorKey: 'totalSales',
    header: 'Total Sales (USD)',
    cell: ({ row }) => `$${row.original.totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      return (
        <div className="text-right">
            <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/admin/live-shopping/analytics?streamId=${row.original.id}`}>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    View Analytics
                </Link>
            </Button>
        </div>
      );
    },
  },
];

export default function AdminApprovedStreamsPage() {
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
          <CheckCircle className="h-8 w-8 text-green-500" />
          Approved Live Streams
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
                        No approved streams found.
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
