
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
  BarChart2,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  ClipboardCopy,
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
import { useUser } from '@/firebase';
import type { BoostRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const StatCard = ({ title, value, icon: Icon, description, color, isLoading }: { title: string, value: string, icon: React.ElementType, description?: string, color?: string, isLoading?: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{value}</div>}
            {description && !isLoading && <p className="text-xs text-muted-foreground">{description}</p>}
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
  const { user } = useUser();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = React.useState<BoostRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const fetchCampaigns = React.useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/campaigns', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch campaigns');
        }
        const data = await response.json();
        setCampaigns(data);
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch campaigns.' });
    } finally {
        setIsLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
      fetchCampaigns();
  }, [fetchCampaigns]);


  const stats = React.useMemo(() => {
      const totalSpend = campaigns.reduce((acc, c) => c.pointsPaid || 0, 0);
      const totalClicks = campaigns.reduce((acc, c) => acc.analytics?.clicks || 0, 0);
      const totalConversions = campaigns.reduce((acc, c) => acc.analytics?.conversions || 0, 0);
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      return { totalSpend, totalClicks, totalConversions, avgCpc };
  }, [campaigns]);

  const columns: ColumnDef<BoostRequest>[] = [
    {
      accessorKey: 'caption',
      header: 'Campaign',
      cell: ({ row }) => <p className="font-medium truncate max-w-xs">{row.original.caption}</p>,
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
          draft: 'secondary',
          pending: 'secondary',
          approved: 'default',
          rejected: 'destructive',
        }[status] as any;
        return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
      },
    },
    { accessorKey: 'sellerId', header: 'Seller ID', cell: ({ row }) => <p className="text-xs font-mono">{row.original.sellerId}</p> },
    { accessorKey: 'pointsPaid', header: 'Cost (Points)', cell: ({ row }) => `${row.original.pointsPaid.toLocaleString()}` },
    { accessorKey: 'analytics.clicks', header: 'Clicks', cell: ({ row }) => row.original.analytics.clicks.toLocaleString() },
    { accessorKey: 'analytics.conversions', header: 'Conversions', cell: ({ row }) => row.original.analytics.conversions.toLocaleString() },
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
            <DropdownMenuItem>View Campaign</DropdownMenuItem>
            <DropdownMenuItem>Pause Campaign</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">End Campaign</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const table = useReactTable({
    data: campaigns,
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
            <StatCard isLoading={isLoading} title="Total Ad Spend" value={`${stats.totalSpend.toLocaleString()} pts`} icon={DollarSign} />
            <StatCard isLoading={isLoading} title="Total Clicks Generated" value={stats.totalClicks.toLocaleString()} icon={MousePointerClick} />
            <StatCard isLoading={isLoading} title="Total Conversions" value={stats.totalConversions.toLocaleString()} icon={TrendingUp} />
            <StatCard isLoading={isLoading} title="Average CPC" value={`${stats.avgCpc.toFixed(2)} pts`} icon={BarChart2} />
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
