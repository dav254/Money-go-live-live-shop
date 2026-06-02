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
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import type { LiveSession, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Users, Clock, ShieldAlert, StopCircle, UserX, ExternalLink, MoreVertical, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const SellerCell = ({ sellerId }: { sellerId: string }) => {
  const firestore = useFirestore();
  const userRef = useMemoFirebase(() => doc(firestore, 'userProfiles', sellerId), [
    firestore,
    sellerId,
  ]);
  const { data: user, isLoading } = useDoc<UserProfile>(userRef);
  if (isLoading) return <Skeleton className="h-8 w-24" />;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={user?.profilePictureUrl} />
        <AvatarFallback>{user?.fullName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-bold text-white truncate uppercase tracking-tight">{user?.shopName || user?.fullName}</span>
        <span className="text-[9px] text-muted-foreground font-mono">{sellerId.substring(0, 8)}</span>
      </div>
    </div>
  );
};

export default function AdminLiveSessionsPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'liveSessions'),
      where('status', '==', 'live')
    );
  }, [firestore]);

  const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
  
  const handleEndStream = React.useCallback(async (sessionId: string) => {
    if (!currentUser) return;
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/live-session', {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ liveSessionId: sessionId })
        });
        
        if (!response.ok) throw new Error("Failed to terminate stream");

        toast({
            title: "STREAM TERMINATED",
            description: "The live signal has been cut and recorded.",
        });
    } catch (e) {
        toast({ variant: 'destructive', title: "Moderation Failed" });
    }
  }, [currentUser, toast]);

  const handleSuspendSeller = React.useCallback(async (sellerId: string) => {
    if (!firestore) return;
    try {
        await updateDoc(doc(firestore, 'userProfiles', sellerId), {
            status: 'suspended'
        });
        // Also kill their stream
        await handleEndStream(sellerId);
        toast({
            title: "SELLER SUSPENDED",
            description: "Access revoked and all active signals terminated.",
            variant: "destructive"
        });
    } catch (e) {
        toast({ variant: 'destructive', title: "Action Failed" });
    }
  }, [firestore, handleEndStream, toast]);

  const columns: ColumnDef<LiveSession>[] = React.useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Session',
       cell: ({ row }) => <div className="font-black text-xs uppercase tracking-tighter text-white">{row.original.title}</div>
    },
    {
      accessorKey: 'sellerId',
      header: 'Host',
      cell: ({ row }) => <SellerCell sellerId={row.original.sellerId} />,
    },
    {
      accessorKey: 'status',
      header: 'Signal',
      cell: ({ row }) => (
          <Badge className="bg-red-600 hover:bg-red-700 animate-pulse border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5">
            <Radio className="mr-1.5 h-3 w-3" /> {row.original.status}
          </Badge>
      ),
    },
    {
      accessorKey: 'viewerCount',
      header: () => <div className="text-right">Audience</div>,
      cell: ({ row }) => (
          <div className="text-right flex items-center justify-end gap-2">
              <Users className="h-3 w-3 text-primary" /> 
              <span className="text-[11px] font-black">{(row.original.viewerCount || 0).toLocaleString()}</span>
          </div>
      ),
    },
     {
      accessorKey: 'startTime',
      header: () => <div className="text-right">Uptime</div>,
      cell: ({ row }) => {
          const startTime = row.original.startTime?.toDate();
          if (!startTime) return <div className="text-right">-</div>;
          return (
              <div className="text-right text-[10px] font-bold text-muted-foreground uppercase flex items-center justify-end gap-1.5">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(startTime, { addSuffix: false })}
              </div>
          );
      },
    },
    {
        id: 'actions',
        header: () => <div className="text-right">Moderation</div>,
        cell: ({row}) => (
            <div className="text-right">
                <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/5">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-2xl border-white/10">
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monitor</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/buyer/live/${row.original.sellerId}`} className="cursor-pointer font-bold text-xs uppercase">
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> Watch Stream
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-red-500">Security Actions</DropdownMenuLabel>
                            <DropdownMenuItem 
                                className="text-red-500 focus:text-red-400 font-bold text-xs uppercase"
                                onClick={() => handleEndStream(row.original.id)}
                            >
                                <StopCircle className="mr-2 h-3.5 w-3.5" /> Terminate Stream
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive font-black text-xs uppercase">
                                    <UserX className="mr-2 h-3.5 w-3.5" /> Suspend Seller
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent className="rounded-3xl border-white/10 bg-neutral-950">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-black uppercase tracking-tighter text-white">Emergency Suspension?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">
                                This will permanently revoke the seller's access and kill their live signal immediately. Use only for severe policy violations.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => handleSuspendSeller(row.original.sellerId)}
                                className="bg-red-600 hover:bg-red-700 rounded-xl font-black uppercase text-[10px]"
                            >
                                CONFIRM SUSPENSION
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        )
    }
  ], [handleEndStream, handleSuspendSeller]);

  const table = useReactTable({
    data: liveSessions || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                 <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
                    Live Control Room
                </h1>
                <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-1">Real-time monitoring and moderation of all active signals</p>
            </div>
            <div className="flex items-center gap-3">
                <div className="bg-red-600/10 border border-red-600/20 px-6 py-2 rounded-2xl flex items-center gap-4 shadow-xl">
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-red-500 tracking-widest">Active Shows</p>
                        <p className="text-xl font-black text-white">{liveSessions?.length || 0}</p>
                    </div>
                    <Video className="h-6 w-6 text-red-600 animate-pulse" />
                </div>
            </div>
        </div>

        {isLoading ? (
            <div className="rounded-[2rem] border border-white/5 overflow-hidden">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-none border-b border-white/5" />)}
            </div>
        ) : (
            <div className="rounded-[2rem] border border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-white/5 hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                    ))}
                    </TableRow>
                ))}
                </TableHeader>
                <TableBody>
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="border-white/5 hover:bg-white/5 transition-colors group h-20">
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-6">
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
                    <TableCell colSpan={columns.length} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center opacity-30">
                            <ShieldAlert className="h-12 w-12 text-neutral-500 mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">The floor is empty. No active sessions.</p>
                        </div>
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </div>
        )}
      </div>
    </AdminLayout>
  );
}
