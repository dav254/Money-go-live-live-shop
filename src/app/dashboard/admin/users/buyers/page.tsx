'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, Trash2, UserRound } from 'lucide-react';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { sendDirectNotification } from '@/app/actions/notification-actions';

type Buyer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  ordersCount: number;
  walletBalance: number;
  joinedDate: string;
  status: 'active' | 'suspended';
  avatarUrl?: string;
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

/* ------------------------------------------------------------------ dialogs */

/**
 * BUYER · PROFILE DIALOG ("View Profile").
 *
 * There is no per-user route under /dashboard/admin/users, and the orders,
 * finance and referrals screens already deep-link here with ?userId=/?id= —
 * so this dialog is the profile view those links were pointing at. It renders
 * from the row's own data; nothing extra is fetched.
 */
const BuyerProfileDialog = ({
  buyer, isOpen, onOpenChange, onViewOrders,
}: {
  buyer: Buyer | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onViewOrders: (buyer: Buyer) => void;
}) => {
  if (!buyer) return null;
  const joined = buyer.joinedDate
    ? new Date(buyer.joinedDate).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : 'Unknown';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={buyer.avatarUrl} />
              <AvatarFallback>{buyer.name.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 truncate">{buyer.name || 'Buyer'}</span>
          </DialogTitle>
          <DialogDescription>Buyer account details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 py-1">
          <ProfileRow label="Email" value={buyer.email || 'Not provided'} />
          <ProfileRow label="Phone" value={buyer.phone || 'Not provided'} />
          <ProfileRow label="Status" value={buyer.status} />
          <ProfileRow label="Member since" value={joined} />
          <ProfileRow label="Wallet balance" value={`$${buyer.walletBalance.toLocaleString()}`} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => { onOpenChange(false); onViewOrders(buyer); }}>
            View Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * BUYER · SEND NOTIFICATION DIALOG.
 *
 * Same contract as the sellers page's dialog: one server action
 * (`sendDirectNotification`) writes the in-app notification and pushes it.
 */
const SendNotificationDialog = ({
  buyer, isOpen, onOpenChange,
}: {
  buyer: Buyer | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
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

  if (!buyer) return null;

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ variant: 'destructive', title: 'Title and message are required.' });
      return;
    }
    setIsSending(true);
    try {
      const result = await sendDirectNotification({
        userId: buyer.id,
        title: title.trim(),
        message: message.trim(),
      });
      if (result.success) {
        toast({ title: 'Notification sent', description: `Sent to ${buyer.name || 'the buyer'}.` });
        onOpenChange(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to send', description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send notification to {buyer.name || 'this buyer'}</DialogTitle>
          <DialogDescription>
            Delivered to their in-app inbox and as a push notification.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Your order is on the way"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the message…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Mail className="mr-2 h-4 w-4" />
            Send notification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------- page */

function AdminBuyersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const [selectedBuyer, setSelectedBuyer] = React.useState<Buyer | null>(null);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);

  // `?userId=` (orders / finance pages) and `?id=` (referrals pages) both
  // point at this screen — open the profile dialog straight away so those
  // links actually show the buyer instead of silently ignoring the param.
  const linkUserId = searchParams?.get('userId') || searchParams?.get('id') || '';
  const handledLinkRef = React.useRef(false);

  const buyersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'userProfiles'), where('userRole', '==', 'buyer'));
  }, [firestore]);

  const { data: buyersData, isLoading } = useCollection<UserProfile>(buyersQuery);

  const data: Buyer[] = React.useMemo(() => {
    if (!buyersData) return [];
    return buyersData.map(profile => ({
      id: profile.id,
      name: profile.fullName,
      email: profile.email || '',
      phone: profile.phoneNumber,
      ordersCount: 0,
      walletBalance: 0.00,
      joinedDate: profile.joinDate,
      status: profile.status || 'active',
      avatarUrl: profile.profilePictureUrl,
    }));
  }, [buyersData]);

  React.useEffect(() => {
    if (isLoading || !linkUserId || handledLinkRef.current) return;
    handledLinkRef.current = true;
    const found = data.find((b) => b.id === linkUserId);
    if (found) {
      setSelectedBuyer(found);
      setIsProfileOpen(true);
    } else {
      toast({
        title: 'Buyer not found',
        description: 'That account is not in the buyers list.',
      });
    }
  }, [isLoading, linkUserId, data, toast]);

  const handleStatusUpdate = async (userId: string, newStatus: 'active' | 'suspended') => {
    if (!firestore) return;
    const userRef = doc(firestore, 'userProfiles', userId);
    try {
      await updateDoc(userRef, { status: newStatus });
      // Keep the local row honest even before the snapshot lands, so the
      // badge flips with the toast.
      setSelectedBuyer((prev) => (prev && prev.id === userId ? { ...prev, status: newStatus } : prev));
      toast({ title: 'Success', description: `Buyer status updated to ${newStatus}.` });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { status: newStatus },
      }));
      toast({ variant: 'destructive', title: 'Could not update status', description: 'The change was refused. Check the permission banner.' });
    }
  };

  const handleDeleteBuyer = async (userId: string) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'userProfiles', userId);
    try {
      await deleteDoc(userRef);
      if (selectedBuyer?.id === userId) {
        setIsProfileOpen(false);
        setSelectedBuyer(null);
      }
      toast({ title: 'Buyer deleted', description: 'The buyer account has been removed.' });
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'delete',
      }));
      toast({ variant: 'destructive', title: 'Could not delete', description: 'The delete was refused. Check the permission banner.' });
    }
  };

  const openProfile = (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    setIsProfileOpen(true);
  };

  const openNotification = (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    setIsNotificationOpen(true);
  };

  const viewOrders = (buyer: Buyer) => {
    router.push(`/dashboard/admin/orders/all?buyerId=${encodeURIComponent(buyer.id)}`);
  };

  const columns: ColumnDef<Buyer>[] = React.useMemo(() => [
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
      accessorKey: 'name',
      header: 'Profile',
      cell: ({ row }) => (
          <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                  <AvatarImage src={row.original.avatarUrl} />
                  <AvatarFallback>{(row.original.name || '?').charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{row.original.name || 'Unnamed buyer'}</span>
          </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
     {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => row.original.phone || 'N/A'
    },
    {
      accessorKey: 'ordersCount',
      header: 'Orders',
      cell: ({ row }) => <div className="text-center">{row.getValue('ordersCount')}</div>,
    },
    {
      accessorKey: 'walletBalance',
      header: ({ column }) => (
          <div className="text-right">
              <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
                  Wallet Balance
                  <CaretSortIcon className="ml-2 h-4 w-4" />
              </Button>
          </div>
      ),
      cell: ({ row }) => <div className="text-right">{row.original.walletBalance.toLocaleString()}</div>,
    },
    {
      accessorKey: 'joinedDate',
      header: 'Joined Date',
       cell: ({ row }) => row.original.joinedDate
        ? new Date(row.original.joinedDate).toLocaleDateString()
        : 'N/A',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
          const buyer = row.original;
          const status = buyer.status;
          return (
            <div className="flex items-center gap-2">
              <Badge variant={status === 'active' ? 'default' : 'destructive'} className={status === 'active' ? 'bg-green-600/80' : ''}>{status}</Badge>
              {status === 'suspended' ? (
                <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(buyer.id, 'active')}>
                  Unsuspend
                </Button>
              ) : (
                // Visible right in the row — suspending a buyer who breaks the
                // rules is a routine moderation action, so it must not be
                // reachable only through the ⋯ menu.
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-600">
                      Suspend
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Suspend {buyer.name || 'this buyer'}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The buyer will not be able to sign in until you reinstate the account.
                        Use this when someone does not comply with the platform rules.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => handleStatusUpdate(buyer.id, 'suspended')}
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
        const buyer = row.original;
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
                <DropdownMenuItem onSelect={() => openProfile(buyer)}>
                  <UserRound className="mr-2 h-4 w-4" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => viewOrders(buyer)}>
                  View Orders
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openNotification(buyer)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Notification
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {buyer.status !== 'suspended' ? (
                  <DropdownMenuItem
                    className="text-yellow-600"
                    onClick={() => handleStatusUpdate(buyer.id, 'suspended')}
                  >
                    Suspend
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => handleStatusUpdate(buyer.id, 'active')}>
                    Unsuspend
                  </DropdownMenuItem>
                )}
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this buyer?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &quot;{buyer.name || 'this buyer'}&quot; and their profile
                  data from the platform. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => handleDeleteBuyer(buyer.id)}
                >
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
    // eslint-disable not needed: every handler below is recreated per render,
    // so this memo legitimately depends on all of them.
  ], [handleStatusUpdate, handleDeleteBuyer, openProfile, openNotification, viewOrders]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          User Management: Buyers ({data.length})
        </h1>
         <div className="w-full">
            <div className="flex items-center py-4">
                <Input
                placeholder="Filter by name..."
                value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                    table.getColumn('name')?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
                />
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="ml-auto">
                    Columns <ChevronDownIcon className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                        return (
                        <DropdownMenuItem
                            key={column.id}
                            className="capitalize"
                            onSelect={(e) => {
                                e.preventDefault();
                                column.toggleVisibility(!column.getIsVisible())
                            }}
                        >
                            <Checkbox
                                checked={column.getIsVisible()}
                                className="mr-2"
                            />
                            {column.id}
                        </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {isLoading ? <DataTableSkeleton /> : (
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                        return (
                            <TableHead key={header.id}>
                            {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                )}
                            </TableHead>
                        );
                        })}
                    </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                        <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        >
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
                        <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                        >
                        No buyers found.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            )}
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of{' '}
                {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="space-x-2">
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
        </div>

        <BuyerProfileDialog
          buyer={selectedBuyer}
          isOpen={isProfileOpen}
          onOpenChange={setIsProfileOpen}
          onViewOrders={viewOrders}
        />
        <SendNotificationDialog
          buyer={selectedBuyer}
          isOpen={isNotificationOpen}
          onOpenChange={setIsNotificationOpen}
        />
      </div>
    </AdminLayout>
  );
}

/**
 * `useSearchParams` must sit under a Suspense boundary (same pattern as
 * /dashboard/products) or the static prerender of this route fails.
 */
export default function AdminBuyersPage() {
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
      <AdminBuyersInner />
    </React.Suspense>
  );
}
