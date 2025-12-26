
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { AdCampaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, BarChart2, Zap, XCircle } from 'lucide-react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// --- Mock Data ---
const mockCampaigns: AdCampaign[] = [
  {
    id: 'camp-1',
    sellerId: 'seller-123',
    productId: 'prod-1',
    productName: 'Classic Leather Handbag',
    productImageUrl: 'https://picsum.photos/seed/handbag/100',
    status: 'active',
    budget: 500,
    spend: 275.50,
    clicks: 1240,
    conversions: 35,
    startDate: new Date().toISOString(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
  },
  {
    id: 'camp-2',
    sellerId: 'seller-456',
    productId: 'prod-2',
    productName: 'NextGen Smartphone',
    productImageUrl: 'https://picsum.photos/seed/phone/100',
    status: 'paused',
    budget: 1000,
    spend: 450.00,
    clicks: 2300,
    conversions: 80,
    startDate: new Date(new Date().setDate(new Date().getDate() - 10)).toISOString(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 20)).toISOString(),
  },
   {
    id: 'camp-3',
    sellerId: 'seller-789',
    productId: 'prod-3',
    productName: 'Gourmet Pasta Kit',
    productImageUrl: 'https://picsum.photos/seed/pasta/100',
    status: 'completed',
    budget: 300,
    spend: 300.00,
    clicks: 850,
    conversions: 102,
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
    endDate: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(),
  },
];
// --- End Mock Data ---


const CreateCampaignDialog = () => {
    const { toast } = useToast();
    const handleCreate = () => {
        // In a real app, this would submit to the backend
        toast({
            title: 'Campaign Created (Mock)',
            description: 'A new ad campaign has been successfully created.',
        });
    }

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Create New Ad Campaign</DialogTitle>
                <DialogDescription>Set up a new promotional campaign for a seller's product.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="seller-id">Seller ID</Label>
                    <Input id="seller-id" placeholder="Enter seller's user ID" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="product-id">Product ID</Label>
                    <Input id="product-id" placeholder="Enter the product ID to promote" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="budget">Budget (USD)</Label>
                    <Input id="budget" type="number" placeholder="e.g., 500" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button type="button" onClick={handleCreate}>Create Campaign</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

const statusConfig = {
    active: { variant: 'default', icon: Zap, className: 'bg-green-600/80' },
    paused: { variant: 'secondary', icon: BarChart2, className: 'bg-yellow-500/80' },
    completed: { variant: 'outline', icon: CheckCircle, className: '' },
    draft: { variant: 'outline', icon: XCircle, className: '' },
};

const columns: ColumnDef<AdCampaign>[] = [
    {
        accessorKey: 'productName',
        header: 'Product',
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <Image src={row.original.productImageUrl} alt={row.original.productName} width={40} height={40} className="rounded-md object-cover" />
                <div>
                    <div className="font-medium">{row.original.productName}</div>
                    <div className="text-xs text-muted-foreground">Seller: {row.original.sellerId.substring(0, 8)}...</div>
                </div>
            </div>
        )
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.status;
            const config = statusConfig[status] || statusConfig.draft;
            const Icon = config.icon;
            return <Badge variant={config.variant} className={`capitalize ${config.className}`}><Icon className="mr-1.5 h-3 w-3" />{status}</Badge>
        }
    },
    {
        accessorKey: 'budget',
        header: 'Budget (USD)',
        cell: ({ row }) => `$${row.original.budget.toLocaleString()}`
    },
    {
        accessorKey: 'spend',
        header: 'Spend (USD)',
        cell: ({ row }) => `$${row.original.spend.toLocaleString()}`
    },
    {
        accessorKey: 'clicks',
        header: 'Clicks',
        cell: ({ row }) => row.original.clicks.toLocaleString()
    },
     {
        accessorKey: 'conversions',
        header: 'Conversions',
        cell: ({ row }) => row.original.conversions.toLocaleString()
    },
    {
        id: 'actions',
        cell: () => <Button size="sm" variant="outline">Manage</Button>
    }
];

export default function AdminAdsPage() {
  const [campaigns, setCampaigns] = React.useState<AdCampaign[]>(mockCampaigns);
  const [isLoading, setIsLoading] = React.useState(false); // For future API calls

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
                Marketing: Ads Manager
            </h1>
             <Dialog>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Campaign
                    </Button>
                </DialogTrigger>
                <CreateCampaignDialog />
            </Dialog>
        </div>

        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map(hg => (
                        <TableRow key={hg.id}>
                            {hg.headers.map(h => <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length > 0 ? (
                        table.getRowModel().rows.map(row => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">No ad campaigns found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
