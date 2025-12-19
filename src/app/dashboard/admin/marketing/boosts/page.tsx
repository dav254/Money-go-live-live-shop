
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
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { BoostRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Clock, Loader2, Video } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


// --- MOCK DATA ---
const mockBoostsData: BoostRequest[] = [
  // Pending
  {
    id: 'boost-pending-1',
    sellerId: 'seller-123',
    productId: 'prod-abc',
    videoUrl: 'https://storage.googleapis.com/web-dev-assets/video-and-source-tags/chrome.mp4',
    caption: 'Check out this amazing new product! You will love it. #new #cool',
    durationDays: 3,
    pointsPaid: 300,
    status: 'pending',
    createdAt: Timestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    updatedAt: Timestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000),
    analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    target: { counties: ['Nairobi'], age: '18-35', interests: ['fashion'] }
  },
  // Approved
  {
    id: 'boost-approved-1',
    sellerId: 'seller-456',
    productId: 'prod-def',
    videoUrl: 'https://storage.googleapis.com/web-dev-assets/video-and-source-tags/chrome.mp4',
    caption: 'Limited time offer on our best-selling gadget!',
    durationDays: 7,
    pointsPaid: 700,
    status: 'approved',
    createdAt: Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    updatedAt: Timestamp.fromMillis(Date.now() - 1 * 24 * 60 * 60 * 1000),
    analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    target: { counties: ['Mombasa'], age: '25-45', interests: ['tech', 'gadgets'] }
  },
  // Rejected
  {
    id: 'boost-rejected-1',
    sellerId: 'seller-789',
    productId: 'prod-ghi',
    videoUrl: 'https://storage.googleapis.com/web-dev-assets/video-and-source-tags/chrome.mp4',
    caption: 'Music is too loud in this one.',
    durationDays: 5,
    pointsPaid: 500,
    status: 'rejected',
    rejectionReason: 'Copyrighted music detected.',
    createdAt: Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updatedAt: Timestamp.fromMillis(Date.now() - 2 * 24 * 60 * 60 * 1000),
    analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 },
    target: { counties: ['Nakuru'], age: '18-24', interests: ['music'] }
  },
];


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
        
        onActionComplete(boost.id, action);
        
        toast({
            title: `Boost ${action}`,
            description: `The boost request has been moved to the '${action}' tab.`,
        });
        setIsSubmitting(false);
        onOpenChange(false);
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
                                <p><strong>Age:</strong> {boost.target?.age || 'N/A'}</p>
                                <p><strong>Counties:</strong> {boost.target?.counties?.join(', ') || 'N/A'}</p>
                                <p><strong>Interests:</strong> {boost.target?.interests?.join(', ') || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => handleAction('rejected')} variant="destructive" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />} Reject
                    </Button>
                    <Button onClick={() => handleAction('approved')} disabled={isSubmitting}>
                         {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />} Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


// Main Component
export default function AdminBoostsPage() {
    const { toast } = useToast();
    const [boosts, setBoosts] = React.useState<BoostRequest[]>(mockBoostsData);
    const [isLoading, setIsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('pending');
    const [selectedBoost, setSelectedBoost] = React.useState<BoostRequest | null>(null);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = React.useState(false);
    
    // Simulate initial loading
    React.useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 700);
        return () => clearTimeout(timer);
    }, []);

    const openReviewDialog = (boost: BoostRequest) => {
        setSelectedBoost(boost);
        setIsReviewDialogOpen(true);
    };

    const handleActionComplete = (boostId: string, action: 'approved' | 'rejected') => {
        setBoosts(prevBoosts =>
            prevBoosts.map(b => 
                b.id === boostId ? { ...b, status: action } : b
            )
        );
    };
    
    const filteredBoosts = React.useMemo(() => {
        return boosts.filter(b => b.status === activeTab);
    }, [boosts, activeTab]);

    const getColumns = (status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed'): ColumnDef<BoostRequest>[] => {
        const baseColumns: ColumnDef<BoostRequest>[] = [
            { accessorKey: 'sellerId', header: 'Seller ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.sellerId}</span> },
            { accessorKey: 'caption', header: 'Caption', cell: ({ row }) => <p className="truncate max-w-sm">{row.original.caption}</p> },
            { accessorKey: 'pointsPaid', header: 'Cost (Points)' },
        ];
        
        return [
            ...baseColumns,
            {
                accessorKey: 'createdAt',
                header: 'Submitted',
                cell: ({ row }) => {
                    const date = row.original.createdAt.toDate();
                    return <span>{formatDistanceToNow(date, { addSuffix: true })}</span>
                }
            },
            {
                id: 'actions',
                header: "Actions",
                cell: ({ row }) => {
                    if (status === 'pending') {
                         return (
                            <Button variant="outline" size="sm" onClick={() => openReviewDialog(row.original)}>
                                Review
                            </Button>
                        )
                    }
                     if (status === 'approved') {
                        return (
                             <Button size="sm" onClick={() => toast({title: "This will post to TikTok"})}>Post to TikTok</Button>
                        )
                    }
                    if (status === 'rejected' && row.original.rejectionReason) {
                        return (
                            <p className="text-xs text-destructive">{row.original.rejectionReason}</p>
                        )
                    }
                    return null;
                },
            },
        ];
    };
    
    const table = useReactTable({ 
        data: filteredBoosts, 
        columns: getColumns(activeTab as any), 
        getCoreRowModel: getCoreRowModel() 
    });

    return (
        <AdminLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">TikTok Boost Management</h1>
                <p className="text-muted-foreground">Review and manage seller-submitted video boost campaigns.</p>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="pending"><Clock className="w-4 h-4 mr-2"/>Pending ({boosts.filter(b => b.status === 'pending').length})</TabsTrigger>
                        <TabsTrigger value="approved"><CheckCircle className="w-4 h-4 mr-2"/>Approved ({boosts.filter(b => b.status === 'approved').length})</TabsTrigger>
                        <TabsTrigger value="active"><Video className="w-4 h-4 mr-2"/>Active ({boosts.filter(b => b.status === 'active').length})</TabsTrigger>
                        <TabsTrigger value="rejected"><XCircle className="w-4 h-4 mr-2"/>Rejected ({boosts.filter(b => b.status === 'rejected').length})</TabsTrigger>
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
                                            <TableRow><TableCell colSpan={getColumns(activeTab as any).length} className="h-24 text-center">Loading...</TableCell></TableRow>
                                        ) : table.getRowModel().rows.length > 0 ? (
                                            table.getRowModel().rows.map(row => (
                                                <TableRow key={row.id}>
                                                    {row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={getColumns(activeTab as any).length} className="h-24 text-center">No requests found for this status.</TableCell></TableRow>
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
