
'use client';

import * as React from 'react';
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
import { Badge } from '@/components/ui/badge';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, query, where, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';

type SellerRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone?: string;
  totalSales: number; // Placeholder
  productCount: number; // Placeholder
  status: 'active' | 'pending' | 'suspended';
  verified: boolean; // Placeholder
  avatarUrl?: string;
  aiPoints: number;
};

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 8 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);


const ManagePointsDialog = ({ user, isOpen, onOpenChange }: { user: SellerRow | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [points, setPoints] = React.useState(0);
    const [isSaving, setIsSaving] = React.useState(false);

    if (!user) return null;

    const handleUpdatePoints = async (operation: 'add' | 'subtract') => {
        if (!firestore || points <= 0) return;

        setIsSaving(true);
        const userRef = doc(firestore, 'userProfiles', user.id);
        const amount = operation === 'add' ? points : -points;
        
        try {
            await updateDoc(userRef, {
                aiPoints: increment(amount)
            });
            toast({ title: 'Success', description: `${points} points ${operation === 'add' ? 'added to' : 'subtracted from'} ${user.ownerName}.` });
            onOpenChange(false);
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { aiPoints: `increment(${amount})` }
            }));
        } finally {
            setIsSaving(false);
            setPoints(0);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage AI Points for {user.ownerName}</DialogTitle>
                    <DialogDescription>
                        Current Balance: <span className="font-bold text-primary">{user.aiPoints.toLocaleString()}</span> points.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="points-amount" className="text-right">Amount</Label>
                        <Input
                            id="points-amount"
                            type="number"
                            value={points === 0 ? '' : points}
                            onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                     <Button type="button" variant="outline" onClick={() => handleUpdatePoints('subtract')} disabled={isSaving || points <= 0}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Subtract Points
                    </Button>
                    <Button type="button" onClick={() => handleUpdatePoints('add')} disabled={isSaving || points <= 0}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Points
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function AdminSellersPage() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState({});
  const [isPointsDialogOpen, setIsPointsDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<SellerRow | null>(null);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  const sellersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller'));
  }, [firestore]);

  const { data: sellersData, isLoading } = useCollection<UserProfile>(sellersQuery);

  const handleStatusUpdate = async (userId: string, newStatus: 'active' | 'suspended') => {
    if (!firestore) return;
    const userRef = doc(firestore, 'userProfiles', userId);
    try {
      await updateDoc(userRef, { status: newStatus });
      toast({ title: 'Success', description: `User status has been updated to ${newStatus}.` });
    } catch (error) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus }
      }));
    }
  };

  const handleDeleteSeller = async (userId: string) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'userProfiles', userId);
    try {
      await deleteDoc(userRef);
      toast({ title: 'Seller Deleted', description: 'The seller has been permanently removed.' });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'delete',
      }));
    }
  };

  const data: SellerRow[] = React.useMemo(() => {
    if (!sellersData) return [];
    return sellersData.map(profile => ({
      id: profile.id,
      businessName: profile.shopName || profile.username,
      ownerName: profile.fullName,
      email: profile.email,
      phone: profile.phoneNumber,
      totalSales: 0, // Placeholder
      productCount: 0, // Placeholder
      status: profile.status || 'active',
      verified: profile.verificationStatus === 'verified',
      avatarUrl: profile.profilePictureUrl,
      aiPoints: profile.aiPoints || 0,
    }));
  }, [sellersData]);
  
  
    const columns: ColumnDef<SellerRow>[] = React.useMemo(() => [
    {
        id: 'select',
        header: ({ table }) => (
        <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
        />
        ),
        cell: ({ row }) => (
        <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
        />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'businessName',
        header: 'Store',
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={row.original.avatarUrl} />
                    <AvatarFallback>{row.original.businessName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-medium">{row.getValue('businessName')}</span>
                    <span className="text-xs text-muted-foreground">{row.original.ownerName}</span>
                </div>
            </div>
        ),
    },
    { accessorKey: 'email', header: 'Email' },
    {
        accessorKey: 'aiPoints',
        header: 'AI Points',
        cell: ({ row }) => <div className="text-center font-medium">{row.original.aiPoints.toLocaleString()}</div>,
    },
    {
        accessorKey: 'verified',
        header: 'Verification',
        cell: ({ row }) => {
            const verified = row.getValue('verified') as boolean;
            return <Badge variant={verified ? 'default' : 'secondary'} className={verified ? 'bg-blue-600/80' : ''}>{verified ? 'Verified' : 'Not Verified'}</Badge>;
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const variant = {
            active: 'default',
            pending: 'secondary',
            suspended: 'destructive',
        }[status] as 'default' | 'secondary' | 'destructive';
        return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const seller = row.original;

            return (
                <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <DotsHorizontalIcon className="h-4 w-4" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/sellers/${seller.id}`} target="_blank">View Store</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast({ title: 'Coming Soon!', description: 'This feature is under development.' })}>
                                View Products
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                                setSelectedUser(seller);
                                setIsPointsDialogOpen(true);
                            }}>Manage Points</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toast({ title: 'Coming Soon!', description: 'This feature is under development.' })}>
                                Freeze Payouts
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-yellow-600" onClick={() => handleStatusUpdate(seller.id, 'suspended')}>
                                Suspend Seller
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive">Delete Seller</DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action will permanently delete the seller account for "{seller.ownerName}" and all associated data. This cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSeller(seller.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            );
        },
    },
    ], [handleDeleteSeller, toast]);


  const table = useReactTable({
    data,
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
          User Management: Sellers
        </h1>
        <div className="w-full">
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter by store, owner, or email..."
              value={(table.getColumn('businessName')?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn('businessName')?.setFilterValue(event.target.value)}
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
                      No sellers found.
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
           <ManagePointsDialog user={selectedUser} isOpen={isPointsDialogOpen} onOpenChange={setIsPointsDialogOpen} />
        </div>
      </div>
    </AdminLayout>
  );
}
