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
import { useCollection, useFirestore, useMemoFirebase, useUser, errorEmitter } from '@/firebase';
import { collection, query, where, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Mail, ShieldAlert } from 'lucide-react';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { sendDirectNotification } from '@/app/actions/notification-actions';

type SellerRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone?: string;
  totalSales: number;
  productCount: number;
  status: 'active' | 'pending' | 'suspended';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
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

const SendNotificationDialog = ({ user, isOpen, onOpenChange }: { user: SellerRow | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    const { toast } = useToast();
    const [title, setTitle] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);

    React.useEffect(() => {
        if (!isOpen) {
            setTitle('');
            setMessage('');
        }
    }, [isOpen]);

    if (!user) return null;

    const handleSend = async () => {
        if (!title || !message) {
            toast({ variant: 'destructive', title: 'Title and message are required.' });
            return;
        }
        setIsSending(true);
        try {
            const result = await sendDirectNotification({
                userId: user.id,
                title,
                message,
            });
            if (result.success) {
                toast({ title: 'Notification Sent!', description: `A notification has been sent to ${user.ownerName}.` });
                onOpenChange(false);
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Send', description: error.message });
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Send Notification to {user.ownerName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="notif-title">Title</Label>
                        <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Welcome!" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="notif-message">Message</Label>
                        <Textarea id="notif-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your message here..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSend} disabled={isSending}>
                        {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Send Notification
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
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<SellerRow | null>(null);
  
  const firestore = useFirestore();
  const { toast } = useToast();

  const sellersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userProfiles'), where('userRole', '==', 'seller'));
  }, [firestore]);

  const { data: sellersData, isLoading } = useCollection<UserProfile>(sellersQuery);

  // Users that exist only in the LOCAL VPS store (their Firestore write
  // failed at signup) still have to show up here — the server returns them
  // and we merge them in, deduped by uid.
  const [vpsOnlySellers, setVpsOnlySellers] = React.useState<SellerRow[]>([]);
  const { user: adminUser } = useUser();
  React.useEffect(() => {
    if (!adminUser) return;
    adminUser.getIdToken().then((token) =>
      fetch('/api/admin/users/list?role=seller', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const rows: SellerRow[] = (data?.extraProfiles ?? []).map((p: any) => ({
            id: String(p.uid),
            businessName: p.username || p.fullName || '—',
            ownerName: p.fullName || '—',
            email: p.email || 'N/A',
            phone: p.phoneNumber || undefined,
            totalSales: 0,
            productCount: 0,
            status: p.status || 'active',
            avatarUrl: p.profilePictureUrl || undefined,
            aiPoints: 0,
          }));
          setVpsOnlySellers(rows);
        })
        .catch(() => {}),
    ).catch(() => {});
  }, [adminUser]);
  
  const handleVerificationUpdate = async (userId: string, newStatus: 'verified' | 'rejected') => {
    if (!firestore) return;
    const userRef = doc(firestore, 'userProfiles', userId);
    try {
      await updateDoc(userRef, { verificationStatus: newStatus });
      toast({
        title: 'Verification Status Updated',
        description: `User has been ${newStatus}.`,
      });
    } catch (error) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { verificationStatus: newStatus }
      }));
    }
  };

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
    const fsRows = (sellersData ?? []).map(profile => ({
      id: profile.id,
      businessName: profile.shopName || profile.username,
      ownerName: profile.fullName,
      email: profile.email || 'N/A',
      phone: profile.phoneNumber,
      totalSales: 0,
      productCount: 0,
      status: profile.status || 'active',
      verificationStatus: profile.verificationStatus,
      avatarUrl: profile.profilePictureUrl,
      aiPoints: profile.aiPoints || 0,
    }));
    const fsIds = new Set(fsRows.map((r) => r.id));
    return [...fsRows, ...vpsOnlySellers.filter((r) => !fsIds.has(r.id))];
  }, [sellersData, vpsOnlySellers]);
  
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
        accessorKey: 'phone',
        header: 'Phone',
        // Same fallback as the buyers table: sellers who signed up before the
        // phone field existed read "N/A" rather than an empty cell.
        cell: ({ row }) => row.original.phone || 'N/A',
    },
    {
        accessorKey: 'aiPoints',
        header: 'AI Points',
        cell: ({ row }) => <div className="text-center font-medium">{row.original.aiPoints.toLocaleString()}</div>,
    },
    {
        accessorKey: 'verificationStatus',
        header: 'Verification',
        cell: ({ row }) => {
            const status = row.original.verificationStatus;
            if (status === 'verified') {
                return <Badge variant="default" className="bg-blue-600/80">Verified</Badge>;
            }
            if (status === 'pending') {
                return <Badge variant="secondary" className="bg-yellow-500/80">Pending</Badge>;
            }
             if (status === 'rejected') {
                return <Badge variant="destructive">Rejected</Badge>;
            }
            return <Badge variant="outline">Not Verified</Badge>;
        },
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
        const seller = row.original;
        const status = seller.status;
        const variant = {
            active: 'default',
            pending: 'secondary',
            suspended: 'destructive',
        }[status] as 'default' | 'secondary' | 'destructive';
        return (
            <div className="flex items-center gap-2">
                <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>
                {status === 'suspended' ? (
                    <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(seller.id, 'active')}>
                        Unsuspend
                    </Button>
                ) : (
                    // Visible, one click from the row — suspension is a routine
                    // moderation action (rule-breakers) and must not live only
                    // inside the ⋯ menu.
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-600">
                                Suspend
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Suspend {seller.businessName}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    The owner will not be able to sign in until you reinstate this account.
                                    Use this when a seller does not comply with the platform rules.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={() => handleStatusUpdate(seller.id, 'suspended')}
                                >
                                    Suspend account
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        );
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
                            <DropdownMenuItem onSelect={() => {
                                setSelectedUser(seller);
                                setIsPointsDialogOpen(true);
                            }}>Manage Points</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => {
                                setSelectedUser(seller);
                                setIsNotificationDialogOpen(true);
                            }}>Send Notification</DropdownMenuItem>
                            <DropdownMenuSeparator />
                             <DropdownMenuLabel>Verification</DropdownMenuLabel>
                            {seller.verificationStatus !== 'verified' && (
                                <DropdownMenuItem className="text-green-600" onClick={() => handleVerificationUpdate(seller.id, 'verified')}>
                                    Approve Verification
                                </DropdownMenuItem>
                            )}
                            {seller.verificationStatus === 'verified' && (
                                <DropdownMenuItem className="text-yellow-600" onClick={() => handleVerificationUpdate(seller.id, 'rejected')}>
                                    Revoke Verification
                                </DropdownMenuItem>
                            )}
                            {seller.verificationStatus !== 'rejected' && seller.verificationStatus !== 'verified' && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleVerificationUpdate(seller.id, 'rejected')}>
                                    Reject Verification
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Account Status</DropdownMenuLabel>
                            {seller.status !== 'suspended' ? (
                                <DropdownMenuItem className="text-yellow-600" onClick={() => handleStatusUpdate(seller.id, 'suspended')}>
                                Suspend Seller
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => handleStatusUpdate(seller.id, 'active')}>
                                Unsuspend Seller
                                </DropdownMenuItem>
                            )}
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive font-bold">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Seller
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action will permanently delete the seller account for "{seller.businessName}" and all associated data from the platform. This action is irreversible.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteSeller(seller.id)} className="bg-destructive hover:bg-destructive/90">Delete Account</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            );
        },
    },
    ], [handleDeleteSeller, handleStatusUpdate, handleVerificationUpdate]);

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
          User Management: Sellers ({data.length})
        </h1>
        <div className="w-full">
          <div className="flex items-center py-4">
            <Input
              placeholder="Filter stores..."
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
           <SendNotificationDialog user={selectedUser} isOpen={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen} />
        </div>
      </div>
    </AdminLayout>
  );
}