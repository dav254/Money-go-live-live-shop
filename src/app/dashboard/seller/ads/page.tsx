
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
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  PlusCircle,
  BarChart2,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Loader2,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Product, AdCampaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// --- Mock Data ---

const mockCampaigns: AdCampaign[] = [
    {
        id: 'camp-1',
        sellerId: 'seller-1',
        productId: 'prod-1',
        productName: 'Classic Handbag Campaign',
        productImageUrl: 'https://picsum.photos/seed/ad1/400',
        status: 'active',
        budget: 5000,
        spend: 2500,
        clicks: 1250,
        conversions: 50,
        startDate: new Date() as any,
    },
    {
        id: 'camp-2',
        sellerId: 'seller-1',
        productId: 'prod-2',
        productName: 'Sneaker Launch',
        productImageUrl: 'https://picsum.photos/seed/ad2/400',
        status: 'completed',
        budget: 10000,
        spend: 10000,
        clicks: 4500,
        conversions: 150,
        startDate: new Date() as any,
    },
     {
        id: 'camp-3',
        sellerId: 'seller-1',
        productId: 'prod-3',
        productName: 'Watch Promotion (Draft)',
        productImageUrl: 'https://picsum.photos/seed/ad3/400',
        status: 'draft',
        budget: 7000,
        spend: 0,
        clicks: 0,
        conversions: 0,
        startDate: new Date() as any,
    },
];

const mockProducts: Product[] = [
    { id: 'prod-1', name: 'Classic Handbag', price: 100, stock: 10, sellerId: 'seller-1', videoUrls: ['/video.mp4'] },
    { id: 'prod-2', name: 'Urban Explorer Sneakers', price: 120, stock: 20, sellerId: 'seller-1', videoUrls: ['/video.mp4'] },
    { id: 'prod-3', name: 'Chronograph Watch', price: 350, stock: 5, sellerId: 'seller-1' }, // No video
];

const mockUser = {
    aiPoints: 15000,
};

// --- Components ---


const StatCard = ({ title, value, icon: Icon, description, color, isLoading }: { title: string, value: string, icon: React.ElementType, description?: string, color?: string, isLoading?: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
        </CardHeader>
        <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
             {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const CreateAdDialog = ({ videoProducts, isLoading, userProfile }: { videoProducts: Product[], isLoading: boolean, userProfile: any }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast({
            title: "Campaign Submitted for Review",
            description: "This is a frontend demo. No data was actually sent."
        });
        setIsSubmitting(false);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" /> Create New Ad</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Ad Campaign</DialogTitle>
                    <DialogDescription>
                        Promote your product on TikTok. Your ad will be reviewed by our team before going live.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Product with Video</label>
                        <Select disabled={isLoading}>
                            <SelectTrigger>
                                <SelectValue placeholder={isLoading ? "Loading products..." : "Choose a product..."} />
                            </SelectTrigger>
                            <SelectContent>
                                {videoProducts.map(product => (
                                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                                ))}
                                {!isLoading && videoProducts.length === 0 && (
                                    <div className="p-4 text-center text-sm text-muted-foreground">No products with videos found.</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Campaign Duration</label>
                        <Select defaultValue="3">
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a duration..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3 Days</SelectItem>
                                <SelectItem value="7">7 Days (1 Week)</SelectItem>
                                <SelectItem value="14">14 Days (2 Weeks)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Your ad budget will be spread evenly over this period.</p>
                    </div>

                    <Alert variant="default" className="bg-blue-950/50 border-blue-500/30">
                      <ShieldCheck className="h-4 w-4 !text-blue-400" />
                      <AlertTitle className="font-semibold !text-blue-300">TikTok Ad Guidelines</AlertTitle>
                      <AlertDescription className="text-blue-300/80">
                        <ul className="list-disc pl-4 space-y-1 text-xs mt-2">
                            <li>**No Misleading Claims:** Do not guarantee results.</li>
                            <li>**High-Quality Video:** Use clear, well-lit video.</li>
                            <li>**No Copyrighted Music:** Use royalty-free audio.</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Create Campaign (5000 Points)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export const columns: ColumnDef<AdCampaign>[] = [
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
        draft: 'secondary',
      }[status] as any;
      return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'spend',
    header: 'Spend (Points)',
    cell: ({ row }) => `${row.original.spend.toLocaleString()} pts`,
  },
  {
    accessorKey: 'clicks',
    header: 'Clicks',
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
          <DropdownMenuItem>Pause Campaign</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete Campaign</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function SellerAdsPage() {
  const isLoading = false; // Set to false for frontend-only
  
  const videoProducts = mockProducts.filter(p => p.videoUrls && p.videoUrls.length > 0);

  const stats = React.useMemo(() => {
      const totalSpend = mockCampaigns.reduce((acc, c) => acc + c.spend, 0);
      const totalClicks = mockCampaigns.reduce((acc, c) => acc + c.clicks, 0);
      const totalConversions = mockCampaigns.reduce((acc, c) => acc + c.conversions, 0);
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      return { totalSpend, totalClicks, totalConversions, avgCpc };
  }, []);

  const table = useReactTable({
    data: mockCampaigns,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                My Ad Campaigns
            </h1>
            <CreateAdDialog 
                videoProducts={videoProducts} 
                isLoading={isLoading} 
                userProfile={mockUser}
            />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard isLoading={isLoading} title="Total Spend" value={`${stats.totalSpend.toLocaleString()} pts`} icon={DollarSign} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Total Clicks" value={`${stats.totalClicks.toLocaleString()}`} icon={MousePointerClick} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Conversions" value={`${stats.totalConversions.toLocaleString()}`} icon={TrendingUp} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Average Cost Per Click" value={`${stats.avgCpc.toFixed(2)} pts`} icon={BarChart2} description="Lifetime" />
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
                        You have not created any ad campaigns.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
      </div>
    </SellerLayout>
  );
}
