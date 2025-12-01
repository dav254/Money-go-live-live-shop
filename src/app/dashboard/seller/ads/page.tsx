
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Product, AdCampaign } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';


// --- Mock Data ---
const mockProducts: Product[] = [
    { id: 'prod-1', name: 'Waterproof Hiking Boots', price: 120, stock: 50, sellerId: 'seller-1', videoUrls: ['/video1.mp4'] },
    { id: 'prod-2', name: 'Classic Leather Handbag', price: 85, stock: 30, sellerId: 'seller-1', imageUrls: ['/img1.jpg'] },
    { id: 'prod-3', name: 'Noise-Cancelling Headphones', price: 250, stock: 20, sellerId:- 'seller-1', videoUrls: ['/video2.mp4', '/video3.mp4'] },
    { id: 'prod-4', name: 'Gourmet Pasta Kit', price: 45, stock: 100, sellerId: 'seller-1' },
];

const mockCampaigns: AdCampaign[] = [
    { id: 'camp-1', productName: 'Waterproof Hiking Boots', status: 'active', budget: 4200, spend: 1500, clicks: 320, conversions: 12, sellerId: 'seller-1', productImageUrl: '', startDate: Timestamp.now() },
    { id: 'camp-2', productName: 'Old Campaign', status: 'completed', budget: 2000, spend: 2000, clicks: 450, conversions: 25, sellerId: 'seller-1', productImageUrl: '', startDate: Timestamp.now() },
    { id: 'camp-3', productName: 'Pending Ad', status: 'draft', budget: 7200, spend: 0, clicks: 0, conversions: 0, sellerId: 'seller-1', productImageUrl: '', startDate: Timestamp.now() },
];
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

const CreateAdDialog = ({ videoProducts, isLoading, userProfile }: { videoProducts: Product[], isLoading: boolean, userProfile: any }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [selectedProductId, setSelectedProductId] = React.useState('');
    const [selectedDuration, setSelectedDuration] = React.useState('3');
    const [isOpen, setIsOpen] = React.useState(false);

    const durationOptions: { [key: string]: { label: string; points: number } } = {
        '3': { label: '3 Days', points: 4200 },
        '7': { label: '7 Days (1 Week)', points: 7200 },
        '14': { label: '14 Days (2 Weeks)', points: 13200 },
    };

    const handleSubmit = async () => {
        if (!selectedProductId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a product to promote.' });
            return;
        }
        
        const costInPoints = durationOptions[selectedDuration].points;
        if ((userProfile?.aiPoints || 0) < costInPoints) {
            toast({ variant: 'destructive', title: 'Insufficient Points', description: `You need ${costInPoints.toLocaleString()} AI points for this campaign.` });
            return;
        }

        setIsSubmitting(true);
        
        console.log({
            productId: selectedProductId,
            durationDays: selectedDuration,
            cost: costInPoints,
        });

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        toast({
            title: "Campaign Submitted for Review (Simulation)",
            description: "Your ad campaign request has been sent to the admin team for approval."
        });

        setIsSubmitting(false);
        setIsOpen(false);
    };

    const costInPoints = durationOptions[selectedDuration].points;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                        <Select onValueChange={setSelectedProductId} disabled={isLoading}>
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
                        <Select defaultValue="3" onValueChange={setSelectedDuration}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a duration..." />
                            </SelectTrigger>
                            <SelectContent>
                               {Object.entries(durationOptions).map(([days, { label }]) => (
                                    <SelectItem key={days} value={days}>{label}</SelectItem>
                               ))}
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
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !selectedProductId}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Create Campaign ({costInPoints.toLocaleString()} Points)
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
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate data fetching
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);
  
  const videoProducts = React.useMemo(() => {
      return mockProducts?.filter(p => p.videoUrls && p.videoUrls.length > 0) || [];
  }, []);

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
                userProfile={{ aiPoints: 10000 }} // Mock user profile with points
            />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Spend" value={`${stats.totalSpend.toLocaleString()} pts`} icon={DollarSign} description="Lifetime" />
            <StatCard title="Total Clicks" value={stats.totalClicks.toLocaleString()} icon={MousePointerClick} description="Lifetime" />
            <StatCard title="Conversions" value={stats.totalConversions.toLocaleString()} icon={TrendingUp} description="Lifetime" />
            <StatCard title="Average Cost Per Click" value={`${stats.avgCpc.toFixed(2)} pts`} icon={BarChart2} description="Lifetime" />
        </div>

        <div className="rounded-md border">
          {isLoading ? (
            <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </SellerLayout>
  );
}
