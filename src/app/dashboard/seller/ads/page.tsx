
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import type { AdCampaign, Product } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


const StatCard = ({ title, value, icon: Icon, description, color, isLoading }: { title: string, value: string, icon: React.ElementType, description?: string, color?: string, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
        </CardHeader>
        <CardContent>
             {isLoading ? <div className="h-8 w-24 bg-muted animate-pulse rounded-md" /> : <div className="text-2xl font-bold">{value}</div>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const CreateAdDialog = ({ products }: { products: Product[] }) => {
    const [selectedProductId, setSelectedProductId] = React.useState<string>('');
    const [budget, setBudget] = React.useState<number>(50);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'You must be logged in.' });
            return;
        }
        if (!selectedProductId || budget <= 0) {
            toast({ variant: 'destructive', title: 'Please select a product and set a budget.' });
            return;
        }
        
        setIsSubmitting(true);
        const selectedProduct = products.find(p => p.id === selectedProductId);
        if (!selectedProduct) return;

        try {
            await addDoc(collection(firestore, 'adCampaigns'), {
                sellerId: user.uid,
                productId: selectedProductId,
                productName: selectedProduct.name,
                productImageUrl: selectedProduct.imageUrl || '',
                status: 'draft',
                budget: budget,
                spend: 0,
                clicks: 0,
                conversions: 0,
                startDate: serverTimestamp(),
            });
            toast({
                title: 'Ad Request Submitted!',
                description: 'Our team will review your request and set up the campaign within 24 hours.'
            });
        } catch (error) {
            console.error("Error creating ad campaign:", error);
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setIsSubmitting(false);
            setSelectedProductId('');
            setBudget(50);
            // We can't close the dialog from here directly, but the parent can handle it.
        }
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create New Ad Campaign</DialogTitle>
                <DialogDescription>Select a product and set a budget. Our team will manually run this ad for you on TikTok and other platforms.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Select Product to Promote</Label>
                    <Select onValueChange={setSelectedProductId} value={selectedProductId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a product..." />
                        </SelectTrigger>
                        <SelectContent>
                            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Set Your Budget (USD)</Label>
                    <Input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min={10} step={5}/>
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isSubmitting || !selectedProductId}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Request
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

export default function SellerAdsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const campaignsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'adCampaigns'), where('sellerId', '==', user.uid));
  }, [user, firestore]);
  
  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [user, firestore]);

  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<AdCampaign>(campaignsQuery);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const isLoading = areCampaignsLoading || areProductsLoading;

  const stats = React.useMemo(() => {
    if (!campaigns) return { totalSpend: 0, totalClicks: 0, totalConversions: 0, avgCpc: 0 };
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    return { totalSpend, totalClicks, totalConversions, avgCpc };
  }, [campaigns]);

  const columns: ColumnDef<AdCampaign>[] = React.useMemo(() => [
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
        const variant: 'default' | 'secondary' | 'outline' = {
          active: 'default',
          completed: 'outline',
          paused: 'secondary',
          draft: 'secondary',
        }[status] as any;
        const color = {
          active: 'bg-green-600/80',
          draft: 'bg-yellow-500/80',
        }[status]
        return <Badge variant={variant} className={cn('capitalize', color)}>{status}</Badge>;
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
  ], []);

  const table = useReactTable({
    data: campaigns || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Dialog>
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    My Ad Campaigns
                </h1>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Create New Ad</Button>
                </DialogTrigger>
            </div>
            <CreateAdDialog products={products || []} />
        </Dialog>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard isLoading={isLoading} title="Total Spend" value={`$${stats.totalSpend.toLocaleString()}`} icon={DollarSign} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Total Clicks" value={stats.totalClicks.toLocaleString()} icon={MousePointerClick} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Conversions" value={stats.totalConversions.toLocaleString()} icon={TrendingUp} description="Lifetime" />
            <StatCard isLoading={isLoading} title="Average CPC" value={`$${stats.avgCpc.toFixed(2)}`} icon={BarChart2} description="Lifetime" />
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
                    {isLoading ? 'Loading campaigns...' : 'You have not created any ad campaigns.'}
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
