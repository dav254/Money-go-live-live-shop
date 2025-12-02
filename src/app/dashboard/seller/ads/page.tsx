
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Product, AdCampaign, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useMemoFirebase, useUserProfile } from '@/firebase';
import { createAdCampaign } from '@/app/actions/ad-actions';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase';

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

const CreateAdDialog = ({ products, isLoading, userProfile }: { products: Product[], isLoading: boolean, userProfile: any }) => {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

    const handleSubmit = async () => {
        if (!selectedProductId) {
            toast({ variant: 'destructive', title: 'Please select a product.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to create a campaign.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const selectedProduct = products.find(p => p.id === selectedProductId);
            if (!selectedProduct) throw new Error("Selected product not found.");
            
            const token = await user.getIdToken();

            const result = await createAdCampaign({
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                productImageUrl: selectedProduct.imageUrl || '',
                budget: 5000, 
            });

            if (result.success) {
                toast({
                    title: "Campaign Submitted for Review",
                    description: "Your ad campaign has been created as a draft and is pending admin approval."
                });
            } else {
                throw new Error(result.error || "An unknown error occurred.");
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: error.message
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const videoProducts = products.filter(p => (p.videoUrl || (p.videoUrls && p.videoUrls.length > 0)));

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" /> Create New Ad</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <CardTitle>Create New Ad Campaign</CardTitle>
                    <CardDescription>
                        Promote your product on TikTok. Your ad will be reviewed by our team before going live.
                    </CardDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Select Product with Video</Label>
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
                        <Label>Campaign Duration</Label>
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
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Create Campaign (5000 Points)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 6 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

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
    accessorKey: 'budget',
    header: 'Budget (Points)',
    cell: ({ row }) => `${row.original.budget.toLocaleString()} pts`,
  },
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
  const { user } = useUser();
  const [campaigns, setCampaigns] = React.useState<AdCampaign[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    async function fetchData() {
        if (!user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/seller/campaigns', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Failed to fetch campaigns');
            }
            const data = await response.json();
            setCampaigns(data.campaigns);
            setProducts(data.products);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error Loading Data',
                description: error.message
            })
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchData();
  }, [user, toast]);

  const stats = React.useMemo(() => {
      if (!campaigns) return { totalSpend: 0, totalClicks: 0, totalConversions: 0, avgCpc: 0 };
      const totalBudget = campaigns.reduce((acc, c) => acc + c.budget, 0);
      const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
      const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
      const avgCpc = totalClicks > 0 ? totalBudget / totalClicks : 0;
      return { totalSpend: totalBudget, totalClicks, totalConversions, avgCpc };
  }, [campaigns]);

  const table = useReactTable({
    data: campaigns || [],
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
                products={products || []}
                isLoading={isLoading} 
                userProfile={null}
            />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard isLoading={isLoading} title="Total Budget" value={`${stats.totalSpend.toLocaleString()} pts`} icon={DollarSign} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Total Clicks" value={`${stats.totalClicks.toLocaleString()}`} icon={MousePointerClick} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Conversions" value={`${stats.totalConversions.toLocaleString()}`} icon={TrendingUp} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Average Cost Per Click" value={`${stats.avgCpc.toFixed(2)} pts`} icon={BarChart2} description="Lifetime" />
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
                            You have not created any ad campaigns.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        )}
      </div>
    </SellerLayout>
  );
}
