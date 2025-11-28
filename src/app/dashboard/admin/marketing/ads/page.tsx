
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
  DotsHorizontalIcon,
  BarChart2,
  MousePointerClick,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type AdCampaign = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  spend: number;
  clicks: number;
  cpc: number; // Cost Per Click
  conversions: number;
};

// --- Mock Data ---
const mockAdCampaigns: AdCampaign[] = [
  { id: 'ad-1', name: 'Summer Handbag Sale', status: 'active', spend: 450.75, clicks: 1250, cpc: 0.36, conversions: 80 },
  { id: 'ad-2', name: 'Tech Gadget Launch - Q3', status: 'completed', spend: 1200.00, clicks: 3400, cpc: 0.35, conversions: 150 },
  { id: 'ad-3', name: 'Holiday Fashion Promo', status: 'paused', spend: 200.00, clicks: 500, cpc: 0.40, conversions: 25 },
  { id: 'ad-4', name: 'New Year, New Gear', status: 'draft', spend: 0, clicks: 0, cpc: 0, conversions: 0 },
];

const mockStats = {
    totalSpend: 1850.75,
    totalClicks: 5150,
    totalConversions: 255,
    avgCpc: 0.36
}
// --- End Mock Data ---

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

export const columns: ColumnDef<AdCampaign>[] = [
  {
    accessorKey: 'name',
    header: 'Campaign',
    cell: ({ row }) => <div className="font-semibold">{row.original.name}</div>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      const variant: 'default' | 'secondary' | 'outline' = {
        active: 'default',
        completed: 'outline',
        paused: 'secondary',
        draft: 'secondary',
      }[status] as any;
      return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'spend',
    header: 'Spend (USD)',
    cell: ({ row }) => `$${row.original.spend.toLocaleString()}`,
  },
  {
    accessorKey: 'clicks',
    header: 'Clicks',
  },
  {
    accessorKey: 'cpc',
    header: 'Avg. CPC',
    cell: ({ row }) => `$${row.original.cpc.toFixed(2)}`,
  },
  {
    accessorKey: 'conversions',
    header: 'Conversions',
  },
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
          <DropdownMenuItem>View Performance</DropdownMenuItem>
          <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
          <DropdownMenuItem>Pause Campaign</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete Campaign</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function AdminAdsPage() {
  const table = useReactTable({
    data: mockAdCampaigns,
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
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Ad
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Spend" value={`$${mockStats.totalSpend.toLocaleString()}`} icon={DollarSign} description="Last 30 days" />
            <StatCard title="Total Clicks" value={mockStats.totalClicks.toLocaleString()} icon={MousePointerClick} description="Last 30 days" />
            <StatCard title="Conversions" value={mockStats.totalConversions.toLocaleString()} icon={TrendingUp} description="Last 30 days" />
            <StatCard title="Average CPC" value={`$${mockStats.avgCpc.toFixed(2)}`} icon={BarChart2} description="Last 30 days" />
        </div>

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
      </div>
    </AdminLayout>
  );
}
