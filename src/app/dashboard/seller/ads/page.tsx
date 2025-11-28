
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
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { AdCampaign, Product } from '@/lib/types';
import { collection, doc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const formSchema = z.object({
    productId: z.string().min(1, 'Please select a product to advertise.'),
    budget: z.coerce.number().min(5, 'Minimum budget is $5.'),
});

const CreateAdDialog = ({ products, open, onOpenChange, onCampaignCreated }: { products: Product[], open: boolean, onOpenChange: (open: boolean) => void, onCampaignCreated: () => void }) => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isCreating, setIsCreating] = React.useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { productId: '', budget: 50 },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user || !firestore) return;

        const selectedProduct = products.find(p => p.id === values.productId);
        if (!selectedProduct) {
            toast({ variant: 'destructive', title: 'Product not found' });
            return;
        }

        setIsCreating(true);
        const newCampaign: Omit<AdCampaign, 'id'> = {
            sellerId: user.uid,
            productId: values.productId,
            productName: selectedProduct.name,
            productImageUrl: selectedProduct.imageUrl || '',
            status: 'active',
            budget: values.budget,
            spend: 0,
            clicks: 0,
            conversions: 0,
            startDate: serverTimestamp() as any,
            endDate: serverTimestamp() as any, // Placeholder
        };
        
        try {
            await addDoc(collection(firestore, 'adCampaigns'), newCampaign);
            toast({ title: 'Campaign Created!', description: 'Your new ad campaign is now active.' });
            onCampaignCreated();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create campaign.' });
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Ad Campaign</DialogTitle>
                    <DialogDescription>Select a product and set a budget to start advertising.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="productId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Product</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a product to promote" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {products.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="budget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Campaign Budget (USD)</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isCreating}>
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Launch Campaign
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

const StatCard = ({ title, value, icon: Icon, description, color }: { title: string, value: string, icon: React.ElementType, description?: string, color?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={cn('h-4 w-4 text-muted-foreground', color)} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
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
      const variant: 'default' | 'secondary' | 'outline' = {
        active: 'default',
        completed: 'outline',
        paused: 'secondary',
        draft: 'secondary',
      }[status] as any;
      return <Badge variant={variant} className={cn('capitalize', status === 'active' ? 'bg-green-600/80' : '')}>{status}</Badge>;
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
];

export default function SellerAdsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);

  const campaignsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'adCampaigns'), where('sellerId', '==', user.uid));
  }, [user, firestore, key]);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [user, firestore]);

  const { data: campaigns, isLoading: areCampaignsLoading } = useCollection<AdCampaign>(campaignsQuery);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const stats = React.useMemo(() => {
    if (!campaigns) return { totalSpend: 0, totalClicks: 0, totalConversions: 0, avgCpc: 0 };
    const totalSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
    const totalConversions = campaigns.reduce((acc, c) => acc + c.conversions, 0);
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    return { totalSpend, totalClicks, totalConversions, avgCpc };
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
          <Button onClick={() => setIsDialogOpen(true)} disabled={areProductsLoading}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Ad
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Spend" value={`$${stats.totalSpend.toLocaleString()}`} icon={DollarSign} description="Lifetime" />
            <StatCard title="Total Clicks" value={stats.totalClicks.toLocaleString()} icon={MousePointerClick} description="Lifetime" />
            <StatCard title="Conversions" value={stats.totalConversions.toLocaleString()} icon={TrendingUp} description="Lifetime" />
            <StatCard title="Average CPC" value={`$${stats.avgCpc.toFixed(2)}`} icon={BarChart2} description="Lifetime" />
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
              {areCampaignsLoading ? (
                 <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        Loading campaigns...
                    </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
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
         {products && <CreateAdDialog products={products} open={isDialogOpen} onOpenChange={setIsDialogOpen} onCampaignCreated={() => setKey(prev => prev + 1)} />}
      </div>
    </SellerLayout>
  );
}
