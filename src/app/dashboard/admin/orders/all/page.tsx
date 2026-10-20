
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  CaretSortIcon,
  ChevronDownIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc, useUserProfile } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import type { Order, UserProfile, Product, SellerShop } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Truck, Calendar, User, ShoppingCart, DollarSign, Home, Milestone, Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 7 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

const getStatusBadge = (status: Order['orderStatus']) => {
    const config = {
        delivered: { label: 'Delivered', className: 'bg-green-600/80 hover:bg-green-600/70' },
        shipped: { label: 'Shipped', className: 'bg-indigo-500/80 hover:bg-indigo-500/70' },
        processing: { label: 'Processing', className: 'bg-blue-500/80 hover:bg-blue-500/70' },
        packed: { label: 'Packed', className: 'bg-purple-500/80 hover:bg-purple-500/70' },
        delivery: { label: 'Out for Delivery', className: 'bg-teal-500/80 hover:bg-teal-500/70' },
        pending: { label: 'Pending', className: 'bg-yellow-500/80 hover:bg-yellow-500/70' },
        paid: { label: 'Paid', className: 'bg-emerald-500/80 hover:bg-emerald-500/70' },
        cancelled: { label: 'Cancelled', className: 'bg-red-500/80 hover:bg-red-500/70' },
        disputed: { label: 'Disputed', className: 'bg-orange-500/80 hover:bg-orange-500/70' },
        refunded: { label: 'Refunded', className: 'bg-gray-500/80 hover:bg-gray-500/70' },
    };
    const currentConfig = (config[status] ?? { label: 'Unknown', className: 'bg-gray-400' }) as { label: string; className?: string };

    return <Badge className={`capitalize ${currentConfig.className ?? ''}`}>{currentConfig.label}</Badge>;
}

const OrderDetailsDialog = ({ order, isOpen, onOpenChange }: { order: Order | null; isOpen: boolean; onOpenChange: (open: boolean) => void }) => {
    const firestore = useFirestore();

    const buyerProfileRef = useMemoFirebase(() => order ? doc(firestore, 'userProfiles', order.buyerId) : null, [firestore, order]);
    const sellerProfileRef = useMemoFirebase(() => order ? doc(firestore, 'userProfiles', order.sellerId) : null, [firestore, order]);
    const { data: buyer } = useDoc<UserProfile>(buyerProfileRef);
    const { data: seller } = useDoc<UserProfile>(sellerProfileRef);

    if (!order) return null;
    
    const timeline = Array.isArray(order.timeline) ? order.timeline : [{ status: order.orderStatus, date: order.orderDate }];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Order Details: #{order.id.substring(0, 8)}...</DialogTitle>
                    <DialogDescription>
                        {format(order.orderDate.toDate(), 'PPP p')}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2"><ShoppingCart /> Items</h4>
                        {(order.items || [{...order, name: order.productName, imageUrl: order.productImage, quantity: 1, price: order.productPrice }]).map((item: any, index: number) => (
                             <div key={index} className="flex items-center gap-3">
                                <Image src={item.imageUrl || ''} alt={item.name || ''} width={48} height={48} className="rounded-md object-cover"/>
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">Qty: {item.quantity} @ ${item.price?.toFixed(2)}</p>
                                </div>
                             </div>
                        ))}
                         <Separator />
                         <h4 className="font-semibold flex items-center gap-2"><DollarSign /> Financials</h4>
                         <div className="text-sm space-y-1">
                             <div className="flex justify-between"><span>Subtotal:</span><span>${(order.subtotal || order.productPrice || 0).toFixed(2)}</span></div>
                             <div className="flex justify-between"><span>Shipping:</span><span>${(order.shippingCost || 0).toFixed(2)}</span></div>
                             <div className="flex justify-between font-bold"><span>Total:</span><span>${(order.totalAmount ?? order.productPrice ?? 0).toFixed(2)}</span></div>
                         </div>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2"><Truck /> Shipping & Customer</h4>
                        <div className="text-sm">
                            <p className="font-medium">{buyer?.fullName}</p>
                            <p className="text-muted-foreground">{order.shippingAddress}</p>
                        </div>
                        {order.deliveryProof && (
                        <>
                            <Separator />
                            <h4 className="font-semibold flex items-center gap-2">
                                <Camera /> Proof of Delivery
                            </h4>
                            <a href={order.deliveryProof} target="_blank" rel="noopener noreferrer">
                                <Image
                                src={order.deliveryProof}
                                alt="Proof of delivery"
                                width={300}
                                height={200}
                                className="rounded-md border object-cover hover:opacity-90 transition-opacity"
                                />
                            </a>
                        </>
                        )}
                        <Separator />
                         <h4 className="font-semibold flex items-center gap-2"><Milestone /> Order Timeline</h4>
                         <div className="space-y-3">
                            {timeline.map((event: any, index: number) => (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="h-6 w-6 flex items-center justify-center rounded-full bg-muted">
                                        <Calendar className="h-3 w-3"/>
                                    </div>
                                    <div>
                                        <p className="font-medium text-xs capitalize">{event.status}</p>
                                        <p className="text-xs text-muted-foreground">{format(event.date.toDate(), 'PP p')}</p>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const RefundDialog = ({ order, isOpen, onOpenChange, onConfirm }: { order: Order | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onConfirm: (reason: string) => void }) => {
    const [reason, setReason] = React.useState('');
    const [isRefunding, setIsRefunding] = React.useState(false);

    if (!order) return null;

    const handleConfirm = async () => {
        setIsRefunding(true);
        await onConfirm(reason);
        setIsRefunding(false);
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Issue Refund for Order #{order.id.substring(0, 6)}?</DialogTitle>
                    <DialogDescription>
                        This will reverse the transaction and update the order status to 'refunded'. This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="refund-reason">Reason for Refund (Optional)</Label>
                    <Input id="refund-reason" placeholder="e.g., Customer request" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleConfirm} disabled={isRefunding}>
                        {isRefunding && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirm Refund
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function AdminAllOrdersPage() {
  // `useSearchParams` must live under a Suspense boundary or the static
  // prerender of this route fails (same pattern as /dashboard/products).
  return (
    <React.Suspense
      fallback={
        <AdminLayout>
          <div className="flex-1 space-y-4 p-8 pt-6">
            <DataTableSkeleton />
          </div>
        </AdminLayout>
      }
    >
      <AdminAllOrdersInner />
    </React.Suspense>
  );
}

function AdminAllOrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by "View Orders" on /dashboard/admin/users/buyers (and by any other
  // screen that wants one buyer's orders): the table below narrows to that
  // buyer and the banner says so, with a way back.
  const buyerFilterId = searchParams?.get('buyerId') ?? '';
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isRefundDialogOpen, ReactIsRefundDialogOpen] = React.useState(false);
  
  const { toast } = useToast();
  
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const isAdmin = userProfile?.userRole === 'admin';

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(collection(firestore, 'orders'));
  }, [firestore, isAdmin]);

  const { data: ordersData, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

  // The buyer the banner should name — one doc read, admin-readable.
  const filteredBuyerRef = useMemoFirebase(
    () => (firestore && buyerFilterId ? doc(firestore, 'userProfiles', buyerFilterId) : null),
    [firestore, buyerFilterId],
  );
  const { data: filteredBuyer } = useDoc<UserProfile>(filteredBuyerRef);

  // Client-side narrowing over the data this page already loads: no second
  // query, and the unfiltered table stays one code path.
  const visibleOrders = React.useMemo(
    () =>
      buyerFilterId
        ? (ordersData ?? []).filter((order) => order.buyerId === buyerFilterId)
        : ordersData ?? [],
    [ordersData, buyerFilterId],
  );

  const isLoading = isProfileLoading || areOrdersLoading;

  const handleStatusUpdate = async (orderId: string, status: Order['orderStatus']) => {
    if (!user) return;
    try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/admin/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        toast({ title: 'Success', description: 'Order status has been updated.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleIssueRefund = async (reason: string) => {
    if (!selectedOrder || !user) return;
    
    try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/admin/orders/${selectedOrder.id}/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reason }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to issue refund.');
        
        toast({ title: 'Refund Successful', description: result.message });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Refund Failed', description: error.message });
    }
  };


  const columns: ColumnDef<Order>[] = React.useMemo(() => [
    {
        id: 'select',
        header: ({ table }) => (<Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)} aria-label="Select all" />),
        cell: ({ row }) => (<Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label="Select row" />),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'id',
        header: 'Order ID',
        cell: ({ row }) => <div className="text-xs text-muted-foreground">#{row.original.id.substring(0, 6)}...</div>,
    },
    {
        accessorKey: 'productName',
        header: 'Product',
        cell: ({ row }) => {
            const productName = row.original.items?.[0]?.name || row.original.productName || 'Unnamed Product';
            const productImage = row.original.items?.[0]?.imageUrl || row.original.productImage;
            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-md">
                        <AvatarImage src={productImage || '/placeholder-image.svg'} />
                        <AvatarFallback>{productName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium capitalize">{productName}</span>
                </div>
            );
        },
    },
    {
        accessorKey: 'totalAmount',
        header: () => <div className="text-right">Amount (USD)</div>,
        cell: ({ row }) => <div className="text-right font-medium">${(row.original.totalAmount ?? row.original.productPrice ?? 0).toLocaleString()}</div>,
    },
    {
        accessorKey: 'orderStatus',
        header: 'Status',
        cell: ({ row }) => getStatusBadge(row.original.orderStatus),
    },
    {
        accessorKey: 'orderDate',
        header: 'Date',
        cell: ({ row }) => row.original.orderDate ? new Date(row.original.orderDate.toDate()).toLocaleDateString() : 'N/A',
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <DotsHorizontalIcon className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => { setSelectedOrder(row.original); setIsDetailsOpen(true); }}>View Order Details</DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href={`/dashboard/admin/users/buyers?userId=${row.original.buyerId}`}>View Buyer Profile</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href={`/dashboard/admin/users/sellers?userId=${row.original.sellerId}`}>View Seller Profile</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                     {['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed'].map(status => (
                        <DropdownMenuItem key={status} onSelect={() => handleStatusUpdate(row.original.id, status as Order['orderStatus'])}>
                            Mark as {status.charAt(0).toUpperCase() + status.slice(1)}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => { setSelectedOrder(row.original); ReactIsRefundDialogOpen(true);}}>
                        Issue Refund
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
  ], [handleStatusUpdate]);


  const table = useReactTable({
    data: visibleOrders,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, rowSelection },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Orders & Transactions: All Orders
        </h1>
        {buyerFilterId && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2.5 text-sm">
            <span>
              Showing only orders for{' '}
              <span className="font-semibold">
                {filteredBuyer?.fullName || 'the selected buyer'}
              </span>{' '}
              — {visibleOrders.length} {visibleOrders.length === 1 ? 'order' : 'orders'} found.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.replace('/dashboard/admin/orders/all')}
            >
              Clear filter
            </Button>
          </div>
        )}
        <div className="w-full">
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter by product name..."
              value={(table.getColumn('productName')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('productName')?.setFilterValue(event.target.value)}
              className="max-w-sm"
            />
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
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No orders found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          )}
          <div className="flex items-center justify-end space-x-2 py-4">
             <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
        <OrderDetailsDialog order={selectedOrder} isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} />
        <RefundDialog order={selectedOrder} isOpen={isRefundDialogOpen} onOpenChange={ReactIsRefundDialogOpen} onConfirm={handleIssueRefund} />
      </div>
    </AdminLayout>
  );
}
