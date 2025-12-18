
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button, buttonVariants } from '@/components/ui/button';
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
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { BoostRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase';
import { CheckCircle, XCircle, Clock, Loader2, Video, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// --- Mock Data ---
const mockApprovedBoosts: BoostRequest[] = [
    {
        id: 'boost-approved-1',
        sellerId: 'seller-abc-123',
        productId: 'prod-abc',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/e_sepia/dog.mp4',
        caption: 'Check out these awesome waterproof boots! Perfect for any adventure. #hiking #outdoors',
        durationDays: 7,
        pointsPaid: 700,
        status: 'approved',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() as any,
        updatedAt: new Date().toISOString() as any,
        target: { counties: ['Nairobi'], age: '18-35', interests: ['fashion'] },
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    },
    {
        id: 'boost-approved-2',
        sellerId: 'seller-def-456',
        productId: 'prod-def',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/e_sepia/dog.mp4',
        caption: 'Limited edition graphic tees are here! Get yours before they sell out.',
        durationDays: 3,
        pointsPaid: 300,
        status: 'approved',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() as any,
        updatedAt: new Date().toISOString() as any,
        target: { counties: ['Mombasa'], age: '18-24', interests: ['streetwear'] },
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    },
];

const mockRejectedBoosts: BoostRequest[] = [
    {
        id: 'boost-rejected-1',
        sellerId: 'seller-ghi-789',
        productId: 'prod-ghi',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/e_sepia/dog.mp4',
        caption: 'This is an example of a rejected caption because it contains forbidden words.',
        durationDays: 5,
        pointsPaid: 500,
        status: 'rejected',
        rejectionReason: 'Content guideline violation.',
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() as any,
        updatedAt: new Date().toISOString() as any,
        target: { counties: ['Kisumu'], age: 'all', interests: ['tech'] },
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    },
];

const mockActiveBoosts: BoostRequest[] = [
    {
        id: 'boost-active-1',
        sellerId: 'seller-jkl-101',
        productId: 'prod-jkl',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/e_sepia/dog.mp4',
        caption: '🔥 Our top-selling gadget is now live on TikTok! Don\'t miss out on this viral sensation. #tech #gadgets',
        durationDays: 7,
        pointsPaid: 700,
        status: 'active',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() as any,
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() as any,
        tiktokVideoId: 'simulated_12345',
        target: { counties: ['Nairobi', 'Nakuru'], age: '18-45', interests: ['tech', 'gadgets'] },
        analytics: { views: 125000, likes: 8300, clicks: 2100, shares: 540, conversions: 120 },
    },
];


// Review Dialog Component
const ReviewDialog = ({ boost, isOpen, onOpenChange, onActionComplete }: {
    boost: BoostRequest | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onActionComplete: () => void;
}) => {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleAction = async (action: 'approved' | 'rejected') => {
        if (!boost || !user) return;

        setIsSubmitting(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/admin/boosts', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ boostId: boost.id, action }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `Failed to ${action} boost.`);
            }

            toast({
                title: `Boost ${action.charAt(0).toUpperCase() + action.slice(1)}`,
                description: `The boost request has been successfully ${action}.`,
            });
            onActionComplete();
            onOpenChange(false);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Action Failed',
                description: error.message,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!boost) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Review Boost Request</DialogTitle>
                    <DialogDescription>Review the video and caption, then approve or reject the submission.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Video Preview</CardTitle>
                            </CardHeader>
                             <CardContent className="aspect-w-9 aspect-h-16 bg-muted rounded-b-lg">
                                <video
                                    src={boost.videoUrl}
                                    controls
                                    className="w-full h-full rounded-md"
                                >
                                    Your browser does not support the video tag.
                                </video>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-4">
                        <h3 className="font-semibold">Campaign Details</h3>
                        <p className="text-sm bg-muted/50 p-3 rounded-md"><strong>Caption:</strong> {boost.caption}</p>
                         <div className="grid grid-cols-2 gap-4 text-sm">
                            <p><strong>Seller ID:</strong> <span className="font-mono text-xs">{boost.sellerId}</span></p>
                            <p><strong>Cost:</strong> <span className="font-semibold">{boost.pointsPaid} points</span></p>
                            <p><strong>Duration:</strong> {boost.durationDays} days</p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Targeting</h4>
                            <div className="text-sm space-y-1">
                                <p><strong>Age:</strong> {boost.target.age}</p>
                                <p><strong>Counties:</strong> {boost.target.counties.join(', ')}</p>
                                <p><strong>Interests:</strong> {boost.target.interests.join(', ')}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => handleAction('rejected')} variant="destructive" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />} Reject
                    </Button>
                    <Button onClick={() => handleAction('approved')} variant="default" disabled={isSubmitting}>
                         {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />} Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// Main Component
export default function AdminBoostsPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [boosts, setBoosts] = React.useState<BoostRequest[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('pending');
    const [selectedBoost, setSelectedBoost] = React.useState<BoostRequest | null>(null);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = React.useState(false);

    const fetchBoosts = React.useCallback(async (status: string) => {
        setIsLoading(true);
        if (status === 'approved') {
            setBoosts(mockApprovedBoosts);
            setIsLoading(false);
            return;
        }
        if (status === 'rejected') {
            setBoosts(mockRejectedBoosts);
            setIsLoading(false);
            return;
        }
         if (status === 'active') {
            setBoosts(mockActiveBoosts);
            setIsLoading(false);
            return;
        }
        if (!user) {
            setIsLoading(false);
            return;
        };
        
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/boosts?status=${status}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || 'Failed to fetch boost requests.');
            }
            const data = await response.json();
            setBoosts(data);
        } catch (error: any) {
            console.error("Error fetching admin boosts:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    React.useEffect(() => {
        fetchBoosts(activeTab);
    }, [fetchBoosts, activeTab]);

    const openReviewDialog = (boost: BoostRequest) => {
        setSelectedBoost(boost);
        setIsReviewDialogOpen(true);
    };

    const columns: ColumnDef<BoostRequest>[] = [
        { accessorKey: 'sellerId', header: 'Seller ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.sellerId}</span> },
        { accessorKey: 'caption', header: 'Caption', cell: ({ row }) => <p className="truncate max-w-sm">{row.original.caption}</p> },
        { accessorKey: 'pointsPaid', header: 'Cost' },
        {
            accessorKey: 'createdAt',
            header: 'Submitted',
            cell: ({ row }) => {
                const date = new Date(row.original.createdAt as any);
                 return <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => openReviewDialog(row.original)} disabled={row.original.status !== 'pending'}>
                    Review
                </Button>
            ),
        },
    ];

    const table = useReactTable({ data: boosts, columns, getCoreRowModel: getCoreRowModel() });

    return (
        <AdminLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">TikTok Boost Management</h1>
                <p className="text-muted-foreground">Review and manage seller-submitted video boost campaigns.</p>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="pending"><Clock className="w-4 h-4 mr-2"/>Pending</TabsTrigger>
                        <TabsTrigger value="approved"><CheckCircle className="w-4 h-4 mr-2"/>Approved</TabsTrigger>
                        <TabsTrigger value="rejected"><XCircle className="w-4 h-4 mr-2"/>Rejected</TabsTrigger>
                         <TabsTrigger value="active"><Video className="w-4 h-4 mr-2"/>Active</TabsTrigger>
                    </TabsList>
                    <TabsContent value={activeTab} className="mt-4">
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        {table.getHeaderGroups().map(hg => (
                                            <TableRow key={hg.id}>
                                                {hg.headers.map(h => <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}
                                            </TableRow>
                                        ))}
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            Array.from({ length: 5 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    {columns.map((c, j) => <TableCell key={`${i}-${c.id || j}`}><Skeleton className="h-6 w-full" /></TableCell>)}
                                                </TableRow>
                                            ))
                                        ) : table.getRowModel().rows.length > 0 ? (
                                            table.getRowModel().rows.map(row => (
                                                <TableRow key={row.id}>
                                                    {row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No requests found for this status.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
            <ReviewDialog 
                isOpen={isReviewDialogOpen}
                onOpenChange={setIsReviewDialogOpen}
                boost={selectedBoost}
                onActionComplete={() => fetchBoosts(activeTab)}
            />
        </AdminLayout>
    );
}

