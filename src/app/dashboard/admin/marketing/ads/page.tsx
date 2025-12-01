
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
import {
  PlusCircle,
  BarChart2,
  MousePointerClick,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { AdCampaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon: Icon, description, color }: { title: string, value: string, icon: React.ElementType, description?: string, color?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 7 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


export default function AdminAdsPage() {
  const firestore = useFirestore();

  const campaignsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'adCampaigns'), orderBy('startDate', 'desc'));
  }, [firestore]);

  const { data: campaigns, isLoading } = useCollection<AdCampaign>(campaignsQuery);

  const stats = React.useMemo(() => {
      if (!campaigns) return { totalSpend: 0, totalClicks: 0, totalConversions: 0, avgCpc: 0 };
      const totalSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
      const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
      const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      return { totalSpend, totalClicks, totalConversions, avgCpc };
  }, [campaigns]);

  const columns: ColumnDef<AdCampaign>[] = [
    {
      accessorKey: 'productName',
      header: 'Campaign',
      cell: ({ row }) => <div className="font-semibold">{row.original.productName}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const variant: 'default' | 'secondary' | 'outline' | 'destructive' = {
          active: 'default',
          completed: 'outline',
          paused: 'secondary',
          draft: 'destructive',
        }[status] as any;
        return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
      },
    },
    { accessorKey: 'sellerId', header: 'Seller ID', cell: ({ row }) => <p className="text-xs font-mono">{row.original.sellerId}</p> },
    { accessorKey: 'spend', header: 'Spend (USD)', cell: ({ row }) => `$${row.original.spend.toLocaleString()}` },
    { accessorKey: 'clicks', header: 'Clicks' },
    { accessorKey: 'conversions', header: 'Conversions' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <DotsHorizontalIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>Update Stats</DropdownMenuItem>
            <DropdownMenuItem>Mark as Active</DropdownMenuItem>
            <DropdownMenuItem>Pause Campaign</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">End Campaign</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data: campaigns || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Ads Manager
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Platform Ad Spend" value={`$${stats.totalSpend.toLocaleString()}`} icon={DollarSign} />
            <StatCard title="Total Clicks Generated" value={stats.totalClicks.toLocaleString()} icon={MousePointerClick} />
            <StatCard title="Total Conversions" value={stats.totalConversions.toLocaleString()} icon={TrendingUp} />
            <StatCard title="Average CPC" value={`$${stats.avgCpc.toFixed(2)}`} icon={BarChart2} />
        </div>

        {isLoading ? <DataTableSkeleton /> : (
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
                        No ad campaigns found.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
        )}
      </div>
    </AdminLayout>
  );
}

