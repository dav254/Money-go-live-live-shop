
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { SupportTicket, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { DotsHorizontalIcon, CaretSortIcon } from '@radix-ui/react-icons';

const UserCell = ({ userId }: { userId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', userId), [firestore, userId]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);

  if (isLoading) return <Skeleton className="h-8 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={user?.profilePictureUrl} />
        <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs">{user?.fullName}</span>
    </div>
  );
};

const DataTableSkeleton = () => (
  <div className="rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 5 }).map((_, j) => (
              <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const TicketDetailsDialog = ({ ticket }: { ticket: SupportTicket | null }) => {
    if (!ticket) return null;
    return (
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Ticket Details: #{ticket.id.substring(0, 6)}</DialogTitle>
                <DialogDescription>
                    Review the details of the support ticket below.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                 <div className="space-y-1">
                    <h4 className="font-semibold">User</h4>
                    <UserCell userId={ticket.userId} />
                 </div>
                 <div className="space-y-1">
                    <h4 className="font-semibold">Issue Type</h4>
                    <p className="text-sm text-muted-foreground">{ticket.issueType}</p>
                 </div>
                 {ticket.contactNumber && (
                     <div className="space-y-1">
                        <h4 className="font-semibold">Contact Number</h4>
                        <p className="text-sm text-muted-foreground">{ticket.contactNumber}</p>
                     </div>
                 )}
                 <div className="space-y-1">
                    <h4 className="font-semibold">Full Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>
                 </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button>Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

export default function AdminSupportTicketsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [selectedTicket, setSelectedTicket] = React.useState<SupportTicket | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);


  const ticketsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'supportTickets'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: tickets, isLoading } = useCollection<SupportTicket>(ticketsQuery);

  const handleStatusUpdate = async (ticketId: string, status: 'open' | 'closed') => {
    const ticketRef = doc(firestore, 'supportTickets', ticketId);
    try {
      await updateDoc(ticketRef, { status });
      toast({ title: 'Success', description: `Ticket status updated to ${status}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update ticket status.' });
    }
  };

  const columns: ColumnDef<SupportTicket>[] = React.useMemo(() => [
    {
      accessorKey: 'userId',
      header: 'User',
      cell: ({ row }) => <UserCell userId={row.original.userId} />,
    },
    {
      accessorKey: 'issueType',
      header: 'Issue Type',
      cell: ({ row }) => <Badge variant="outline">{row.original.issueType}</Badge>,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <p className="text-sm text-muted-foreground truncate max-w-sm">{row.original.description}</p>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = status === 'closed' ? 'default' : (status === 'open' ? 'secondary' : 'destructive');
        const color = status === 'closed' ? 'bg-green-600/80' : (status === 'open' ? 'bg-blue-500/80' : 'bg-yellow-500/80');
        return <Badge variant={variant} className={`capitalize ${color}`}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <CaretSortIcon className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => row.original.createdAt?.toDate().toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const ticket = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => {
                  setSelectedTicket(ticket);
                  setIsDialogOpen(true);
              }}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {ticket.status !== 'open' && <DropdownMenuItem onClick={() => handleStatusUpdate(ticket.id, 'open')}>Mark as Open</DropdownMenuItem>}
              {ticket.status !== 'closed' && <DropdownMenuItem onClick={() => handleStatusUpdate(ticket.id, 'closed')}>Mark as Closed</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], [handleStatusUpdate]);

  const table = useReactTable({
    data: tickets || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Support Tickets Queue
        </h1>
         <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {isLoading ? <DataTableSkeleton /> : (
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                        No support tickets found.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </div>
            )}
             <TicketDetailsDialog ticket={selectedTicket} />
        </Dialog>
      </div>
    </AdminLayout>
  );
}
