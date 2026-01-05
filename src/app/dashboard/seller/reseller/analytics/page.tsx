
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
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
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import type { ResellerApplication, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

const ResellerCell = ({ resellerId }: { resellerId: string }) => {
    const firestore = useFirestore();
    const resellerProfileRef = useMemoFirebase(() => {
        if (!firestore || !resellerId) return null;
        return doc(firestore, 'userProfiles', resellerId);
    }, [firestore, resellerId]);
    
    const { data: reseller, isLoading } = useDoc<UserProfile>(resellerProfileRef);

    if (isLoading) {
        return (
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
        );
    }

    if (!reseller) return <span className="text-xs text-muted-foreground">Unknown Reseller</span>;

    return (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={reseller.profilePictureUrl} />
                <AvatarFallback>{reseller.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{reseller.fullName}</p>
                <p className="text-xs text-muted-foreground">{reseller.email}</p>
            </div>
        </div>
    );
};

export default function ResellerApplicationsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const applicationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'resellerApplications'), where('sellerId', '==', user.uid));
    }, [firestore, user]);

    const { data: applications, isLoading } = useCollection<ResellerApplication>(applicationsQuery);
    
    const handleStatusUpdate = async (applicationId: string, status: 'approved' | 'rejected') => {
        if (!firestore) return;
        const appRef = doc(firestore, 'resellerApplications', applicationId);
        try {
            await updateDoc(appRef, { status });
            toast({
                title: 'Application Updated',
                description: `The application has been ${status}.`
            });
        } catch(error) {
            console.error("Error updating application status:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update the application status.' });
        }
    };

    const columns: ColumnDef<ResellerApplication>[] = [
        {
            accessorKey: 'resellerId',
            header: 'Reseller Applicant',
            cell: ({ row }) => <ResellerCell resellerId={row.original.resellerId} />,
        },
        {
            accessorKey: 'applicationDate',
            header: 'Date Applied',
            cell: ({ row }) => row.original.applicationDate ? new Date(row.original.applicationDate.toDate()).toLocaleDateString() : 'N/A'
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                return (
                    <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'} className={`capitalize ${status === 'approved' ? 'bg-green-600/80' : ''}`}>
                        {status}
                    </Badge>
                );
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const application = row.original;
                if (application.status !== 'pending') {
                    return <span className="text-xs text-muted-foreground">Actioned</span>
                }
                return (
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => handleStatusUpdate(application.id, 'rejected')}>Reject</Button>
                        <Button size="sm" onClick={() => handleStatusUpdate(application.id, 'approved')}>Approve</Button>
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: applications || [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <SellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Reseller Applications</h1>
                <p className="text-muted-foreground">
                    Approve or reject resellers who want to sell your products. Approved resellers will be able to share your product links.
                </p>
                
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
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">Loading applications...</TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
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
                                    No reseller applications found.
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
