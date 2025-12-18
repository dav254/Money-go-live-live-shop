
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
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
import { CheckCircle, XCircle, Clock, Loader2, Video } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Timestamp } from 'firebase/firestore';


// --- MOCK DATA ---
const mockBoosts: BoostRequest[] = [
    {
        id: 'boost1',
        sellerId: 'seller_abc',
        productId: 'prod_123',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
        caption: 'Check out this amazing product! You will not regret it. Perfect for summer.',
        durationDays: 3,
        pointsPaid: 300,
        target: { counties: ['Nairobi', 'Mombasa'], age: '18-35', interests: ['fashion', 'music'] },
        status: 'pending',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)), // 1 day ago
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    },
    {
        id: 'boost2',
        sellerId: 'seller_xyz',
        productId: 'prod_456',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/e_sepia/dog.mp4',
        caption: 'New gadget in stock. Limited time offer, get yours now!',
        durationDays: 7,
        pointsPaid: 700,
        target: { counties: ['Kisumu'], age: '25-45', interests: ['tech', 'gadgets'] },
        status: 'pending',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2 days ago
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    },
    {
        id: 'boost3',
        sellerId: 'seller_abc',
        productId: 'prod_789',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/c_scale,w_400/snow_horses.mp4',
        caption: 'Handmade leather wallets. The perfect gift.',
        durationDays: 14,
        pointsPaid: 1400,
        target: { counties: ['Nairobi'], age: '30+', interests: ['luxury', 'gifts'] },
        status: 'approved',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
        analytics: { views: 12500, likes: 800, clicks: 150, shares: 45, conversions: 12 },
    },
    {
        id: 'boost4',
        sellerId: 'seller_def',
        productId: 'prod_101',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/w_400,h_400,c_crop/bowl.mp4',
        caption: 'This caption did not meet our guidelines.',
        durationDays: 3,
        pointsPaid: 300,
        target: { counties: ['Nakuru'], age: '18-25', interests: ['food', 'home'] },
        status: 'rejected',
        rejectionReason: 'Content did not meet guidelines.',
        createdAt: Timestamp.fromDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
        analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    }
];
// --- END MOCK DATA ---


// Review Dialog Component
const ReviewDialog = ({ boost, isOpen, onOpenChange, onActionComplete }: {
    boost: BoostRequest | null;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onActionComplete: (boostId: string, action: 'approved' | 'rejected') => void;
}) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleAction = async (action: 'approved' | 'rejected') => {
        if (!boost) return;

        setIsSubmitting(true);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        toast({
            title: `Boost ${action.charAt(0).toUpperCase() + action.slice(1)}`,
            description: `The boost request has been successfully ${action}.`,
        });
        onActionComplete(boost.id, action);
        onOpenChange(false);
        setIsSubmitting(false);
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
    const [allBoosts, setAllBoosts] = React.useState<BoostRequest[]>(mockBoosts);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('pending');
    const [selectedBoost, setSelectedBoost] = React.useState<BoostRequest | null>(null);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = React.useState(false);

    // Simulate fetching data
    React.useEffect(() => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
        }, 1000);
    }, [activeTab]);

    const handleActionComplete = (boostId: string, action: 'approved' | 'rejected') => {
        setAllBoosts(prevBoosts => 
            prevBoosts.map(b => 
                b.id === boostId ? { ...b, status: action, updatedAt: Timestamp.now() } : b
            )
        );
    };

    const openReviewDialog = (boost: BoostRequest) => {
        setSelectedBoost(boost);
        setIsReviewDialogOpen(true);
    };
    
    const filteredBoosts = React.useMemo(() => {
        return allBoosts.filter(b => b.status === activeTab);
    }, [allBoosts, activeTab]);

    const columns: ColumnDef<BoostRequest>[] = [
        { accessorKey: 'sellerId', header: 'Seller ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.sellerId}</span> },
        { accessorKey: 'caption', header: 'Caption', cell: ({ row }) => <p className="truncate max-w-sm">{row.original.caption}</p> },
        { accessorKey: 'pointsPaid', header: 'Cost' },
        {
            accessorKey: 'createdAt',
            header: 'Submitted',
            cell: ({ row }) => {
                const date = (row.original.createdAt as Timestamp).toDate();
                return <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
            }
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => openReviewDialog(row.original)} disabled={row.original.status !== 'pending'}>
                    Review
                </Button>
            ),
        },
    ];

    const table = useReactTable({ data: filteredBoosts, columns, getCoreRowModel: getCoreRowModel() });

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
                                            Array.from({ length: 3 }).map((_, i) => (
                                                <TableRow key={i}>
                                                    {columns.map((c, j) => <TableCell key={`${i}-${j}`}><Skeleton className="h-6 w-full" /></TableCell>)}
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
                onActionComplete={handleActionComplete}
            />
        </AdminLayout>
    );
}
