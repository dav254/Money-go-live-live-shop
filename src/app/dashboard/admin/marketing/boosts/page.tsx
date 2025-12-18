
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
import { useUser } from '@/firebase';
import { CheckCircle, XCircle, Clock, Loader2, Video, ExternalLink, Eye, Heart, MousePointerClick, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


// Mock Data for frontend-only display
const mockApprovedBoosts: BoostRequest[] = [
    { id: 'boost-abc-123', sellerId: 'seller-abc', caption: 'Check out our new summer collection!', pointsPaid: 300, durationDays: 3, createdAt: new Date(new Date().setDate(new Date().getDate() - 1)) as any, status: 'approved', target: { counties: [], age: '', interests: [] }, videoUrl: '', analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 } },
];
const mockRejectedBoosts: BoostRequest[] = [];
const mockActiveBoosts: BoostRequest[] = [
    { id: 'boost-def-456', sellerId: 'seller-def', caption: '50% off on all electronics this week!', pointsPaid: 700, durationDays: 7, createdAt: new Date(new Date().setDate(new Date().getDate() - 2)) as any, status: 'active', target: { counties: [], age: '', interests: [] }, videoUrl: '', analytics: { views: 12500, likes: 800, clicks: 350, shares: 120, conversions: 45 } },
    { id: 'boost-ghi-789', sellerId: 'seller-ghi', caption: 'Freshly baked goods, available now!', pointsPaid: 1400, durationDays: 14, createdAt: new Date(new Date().setDate(new Date().getDate() - 5)) as any, status: 'active', target: { counties: [], age: '', interests: [] }, videoUrl: '', analytics: { views: 34000, likes: 2100, clicks: 980, shares: 450, conversions: 112 } },
];
const mockCompletedBoosts: BoostRequest[] = [
    { id: 'boost-jkl-101', sellerId: 'seller-jkl', caption: 'Vintage clothing drop last month!', pointsPaid: 700, durationDays: 7, createdAt: new Date(new Date().setDate(new Date().getDate() - 40)) as any, status: 'completed', target: { counties: [], age: '', interests: [] }, videoUrl: '', analytics: { views: 88000, likes: 5400, clicks: 2100, shares: 800, conversions: 250 } },
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
        // Simulate backend call
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
    const { user } = useUser();
    const { toast } = useToast();
    
    const [pendingBoosts, setPendingBoosts] = React.useState<BoostRequest[]>([]);
    const [approvedBoosts, setApprovedBoosts] = React.useState<BoostRequest[]>(mockApprovedBoosts);
    const [rejectedBoosts, setRejectedBoosts] = React.useState<BoostRequest[]>(mockRejectedBoosts);
    const [activeBoosts, setActiveBoosts] = React.useState<BoostRequest[]>(mockActiveBoosts);
    const [completedBoosts, setCompletedBoosts] = React.useState<BoostRequest[]>(mockCompletedBoosts);

    const [isLoading, setIsLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('pending');
    const [selectedBoost, setSelectedBoost] = React.useState<BoostRequest | null>(null);
    const [isReviewDialogOpen, setIsReviewDialogOpen] = React.useState(false);

    const fetchBoosts = React.useCallback(async (status: string) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/boosts?status=${status}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || 'Failed to fetch boost requests.');
            }
            const data = await response.json();
            
            if (status === 'pending') {
                setPendingBoosts(data);
            }
            // For now, we keep mock data for other tabs until they are connected
        } catch (error: any) {
            console.error(`Error fetching ${status} boosts:`, error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    React.useEffect(() => {
        if(user && activeTab === 'pending') {
            fetchBoosts(activeTab);
        } else {
            // For frontend-only tabs, just stop loading
            setIsLoading(false);
        }
    }, [user, activeTab, fetchBoosts]);

    const handleActionComplete = (boostId: string, action: 'approved' | 'rejected') => {
        const boostToMove = pendingBoosts.find(b => b.id === boostId);
        if (!boostToMove) return;

        setPendingBoosts(prev => prev.filter(b => b.id !== boostId));

        if (action === 'approved') {
            setApprovedBoosts(prev => [{ ...boostToMove, status: 'approved' }, ...prev]);
        } else if (action === 'rejected') {
            setRejectedBoosts(prev => [{ ...boostToMove, status: 'rejected' }, ...prev]);
        }
    };

    const openReviewDialog = (boost: BoostRequest) => {
        setSelectedBoost(boost);
        setIsReviewDialogOpen(true);
    };
    
    const getColumns = (status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed'): ColumnDef<BoostRequest>[] => {
        const baseColumns: ColumnDef<BoostRequest>[] = [
            { accessorKey: 'sellerId', header: 'Seller ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.sellerId}</span> },
            { accessorKey: 'caption', header: 'Caption', cell: ({ row }) => <p className="truncate max-w-sm">{row.original.caption}</p> },
            { accessorKey: 'pointsPaid', header: 'Cost' },
        ];
        
        if (status === 'active' || status === 'completed') {
            return [
                ...baseColumns.slice(0, 3), // Seller, Caption, Cost
                { accessorKey: 'analytics.views', header: () => <div className="flex items-center gap-1"><Eye className="h-4 w-4" /> Views</div>, cell: ({ row }) => (row.original.analytics?.views || 0).toLocaleString() },
                { accessorKey: 'analytics.likes', header: () => <div className="flex items-center gap-1"><Heart className="h-4 w-4" /> Likes</div>, cell: ({ row }) => (row.original.analytics?.likes || 0).toLocaleString() },
                { accessorKey: 'analytics.clicks', header: () => <div className="flex items-center gap-1"><MousePointerClick className="h-4 w-4" /> Clicks</div>, cell: ({ row }) => (row.original.analytics?.clicks || 0).toLocaleString() },
                {
                    id: 'actions',
                    header: "Actions",
                    cell: ({ row }) => (
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>View on TikTok</DropdownMenuItem>
                                {status === 'active' && <DropdownMenuItem>Pause Campaign</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ),
                },
            ];
        }

        return [
            ...baseColumns,
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
                header: "Actions",
                cell: ({ row }) => {
                    if (status === 'pending') {
                         return (
                            <Button variant="outline" size="sm" onClick={() => openReviewDialog(row.original)}>
                                Review
                            </Button>
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
    
    const getDataForTab = (tab: string) => {
        switch(tab) {
            case 'pending': return pendingBoosts;
            case 'approved': return approvedBoosts;
            case 'rejected': return rejectedBoosts;
            case 'active': return activeBoosts;
            case 'completed': return completedBoosts;
            default: return [];
        }
    }
    
    const table = useReactTable({ 
        data: getDataForTab(activeTab), 
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
                        <TabsTrigger value="pending"><Clock className="w-4 h-4 mr-2"/>Pending</TabsTrigger>
                        <TabsTrigger value="approved"><CheckCircle className="w-4 h-4 mr-2"/>Approved</TabsTrigger>
                        <TabsTrigger value="rejected"><XCircle className="w-4 h-4 mr-2"/>Rejected</TabsTrigger>
                        <TabsTrigger value="active"><Video className="w-4 h-4 mr-2"/>Active</TabsTrigger>
                        <TabsTrigger value="completed"><CheckCircle className="w-4 h-4 mr-2"/>Completed</TabsTrigger>
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
                                                    {getColumns(activeTab as any).map((c, j) => <TableCell key={`${i}-${j}`}><Skeleton className="h-6 w-full" /></TableCell>)}
                                                </TableRow>
                                            ))
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

