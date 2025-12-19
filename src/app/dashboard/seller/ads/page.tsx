
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { SellerLayout } from '@/components/layout/seller-layout';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { BoostRequest, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useUserProfile, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  BarChart2,
  MousePointerClick,
  Heart,
  Eye,
  Loader2,
  ShieldCheck,
  Rocket,
  Clock,
  CheckCircle,
  XCircle,
  BadgeCent,
  RefreshCw,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, addDays, isPast } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string, icon: React.ElementType, isLoading?: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

const CreateBoostDialog = ({ products, onBoostCreated, userProfile }: { products: Product[], onBoostCreated?: () => void, userProfile: any }) => {
    const { toast } = useToast();
    const { user } = useUser();
    const [isOpen, setIsOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [caption, setCaption] = React.useState('');
    const [durationDays, setDurationDays] = React.useState(3);
    const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
    const [age, setAge] = React.useState('18-35');
    const [counties, setCounties] = React.useState('');
    const [interests, setInterests] = React.useState('');
    const firestore = useFirestore();
    
    const selectedProduct = products.find(p => p.id === selectedProductId);

    const pointsCost = durationDays * 100;
    const hasEnoughPoints = (userProfile?.aiPoints || 0) >= pointsCost;

    React.useEffect(() => {
        setVideoUrl(null);
    }, [selectedProductId]);
    
    const handleSubmit = async () => {
        if (!videoUrl || !user || !selectedProductId || !firestore) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select a product and a video.' });
            return;
        }
        if (!hasEnoughPoints) {
            toast({ variant: 'destructive', title: 'Insufficient Points', description: 'You do not have enough AI points for this boost.' });
            return;
        }

        setIsSubmitting(true);
        toast({ title: 'Submitting Boost Request...', description: 'Please wait.' });
        
        try {
            const boostRequestData = {
                sellerId: user.uid,
                productId: selectedProductId,
                videoUrl: videoUrl,
                caption: caption,
                durationDays: durationDays,
                pointsPaid: pointsCost,
                target: {
                    counties: counties.split(',').map(c => c.trim()).filter(Boolean),
                    age: age,
                    interests: interests.split(',').map(i => i.trim()).filter(Boolean),
                },
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                analytics: { views: 0, likes: 0, clicks: 0, shares: 0, conversions: 0 }
            };
            
            const boostRequestsRef = collection(firestore, 'boost_requests');
            await addDoc(boostRequestsRef, boostRequestData)
             .catch(error => {
                const permissionError = new FirestorePermissionError({
                  path: boostRequestsRef.path,
                  operation: 'create',
                  requestResourceData: boostRequestData,
                });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError; // Rethrow to be caught by the outer catch block
            });


            toast({ title: 'Success!', description: 'Your boost request has been submitted for approval.' });
            if (typeof onBoostCreated === 'function') {
                onBoostCreated();
            }
            setIsOpen(false); 

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" /> Create TikTok Boost</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New TikTok Boost</DialogTitle>
                    <DialogDescription>
                        Promote a product video on TikTok. This action will deduct AI points from your account.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    
                    <div className="space-y-2">
                        <Label>1. Choose a Product</Label>
                        <Select onValueChange={setSelectedProductId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a product..." />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {selectedProduct && selectedProduct.videoUrls && selectedProduct.videoUrls.length > 0 && (
                        <div className="space-y-2">
                             <Label>2. Select a Video</Label>
                             <div className="grid grid-cols-3 gap-2">
                                 {selectedProduct.videoUrls.map((url, index) => (
                                     <button key={index} onClick={() => setVideoUrl(url)} className={`relative aspect-video rounded-md overflow-hidden border-2 ${videoUrl === url ? 'border-primary' : 'border-transparent'}`}>
                                         <video src={url} className="w-full h-full object-cover" muted />
                                     </button>
                                 ))}
                             </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="caption">3. Ad Caption</Label>
                        <Textarea id="caption" placeholder="e.g., 'Check out our new summer collection! #summerfashion'" value={caption} onChange={(e) => setCaption(e.target.value)} />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>4. Targeting Options</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Select value={age} onValueChange={setAge}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Age Range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="18-35">18-35</SelectItem>
                                    <SelectItem value="36-55">36-55</SelectItem>
                                    <SelectItem value="55+">55+</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input placeholder="Counties (e.g., Nairobi, Mombasa)" value={counties} onChange={e => setCounties(e.target.value)} />
                        </div>
                        <Input placeholder="Interests (e.g., fashion, music, tech)" value={interests} onChange={e => setInterests(e.target.value)} />
                        <p className="text-xs text-muted-foreground">Separate counties and interests with commas.</p>
                    </div>

                    <div className="space-y-2">
                        <Label>5. Campaign Duration</Label>
                        <Select value={String(durationDays)} onValueChange={(val) => setDurationDays(Number(val))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a duration..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3 Days</SelectItem>
                                <SelectItem value="7">7 Days (1 Week)</SelectItem>
                                <SelectItem value="14">14 Days (2 Weeks)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <Alert variant="default" className="bg-blue-950/50 border-blue-500/30">
                      <ShieldCheck className="h-4 w-4 !text-blue-400" />
                      <AlertTitle className="font-semibold !text-blue-300">TikTok Ad Guidelines</AlertTitle>
                      <AlertDescription className="text-blue-300/80">
                        <ul className="list-disc pl-4 space-y-1 text-xs mt-2">
                            <li>Video must be high-quality and well-lit.</li>
                            <li>Do not use copyrighted music or watermarks.</li>
                            <li>Content must comply with TikTok's community guidelines.</li>
                        </ul>
                      </AlertDescription>
                    </Alert>
                    {!hasEnoughPoints && (
                         <Alert variant="destructive">
                            <BadgeCent className="h-4 w-4"/>
                            <AlertTitle>Insufficient Points</AlertTitle>
                            <AlertDescription>
                                You need {pointsCost} points for this boost, but you only have {userProfile?.aiPoints || 0}. Please buy more points.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !videoUrl || !selectedProductId || !hasEnoughPoints}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Submit for Approval ({pointsCost} Points)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const ViewDetailsDialog = ({ boost, isOpen, onOpenChange, onRefresh }: { boost: BoostRequest | null; isOpen: boolean; onOpenChange: (open: boolean) => void; onRefresh: (boostId: string) => void; }) => {
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    if (!boost) return null;

    const handleRefreshClick = async () => {
        setIsRefreshing(true);
        try {
            await onRefresh(boost.id);
        } finally {
            setIsRefreshing(false);
        }
    };

    const statusConfig = {
        pending: { icon: Clock, color: 'text-yellow-500', label: 'Pending Review' },
        approved: { icon: CheckCircle, color: 'text-blue-500', label: 'Approved, Awaiting Post' },
        active: { icon: Rocket, color: 'text-green-500', label: 'Live on TikTok' },
        rejected: { icon: XCircle, color: 'text-destructive', label: 'Rejected' },
        completed: { icon: CheckCircle, color: 'text-muted-foreground', label: 'Completed' },
        draft: { icon: Clock, color: 'text-muted-foreground', label: 'Draft' },
    };

    const currentStatus = statusConfig[boost.status] || statusConfig.pending;
    const StatusIcon = currentStatus.icon;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Boost Campaign Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="aspect-w-9 aspect-h-16 bg-muted rounded-md overflow-hidden">
                                <video src={boost.videoUrl} controls className="w-full h-full" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                             <CardTitle className="text-lg flex items-center gap-2">
                                <StatusIcon className={`h-5 w-5 ${currentStatus.color}`} />
                                {currentStatus.label}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                           {boost.status === 'rejected' && (
                                <Alert variant="destructive">
                                    <AlertTitle>Reason for Rejection</AlertTitle>
                                    <AlertDescription>{boost.rejectionReason || 'No reason was provided.'}</AlertDescription>
                                </Alert>
                            )}
                             {boost.status === 'approved' && (
                                <Alert className="bg-blue-500/10 border-blue-500/50">
                                    <AlertDescription>This campaign has been approved by the admin team and is awaiting posting.</AlertDescription>
                                </Alert>
                            )}
                             {boost.status === 'active' && (
                                <Alert className="bg-green-500/10 border-green-500/50">
                                    <AlertDescription>This campaign is currently live on TikTok!</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                   
                     <Card>
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Performance</CardTitle>
                            <Button onClick={handleRefreshClick} size="sm" variant="outline" disabled={isRefreshing || boost.status !== 'active'}>
                                <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                                Refresh Stats
                            </Button>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground"/> <span>Views: <strong>{boost.analytics?.views || 0}</strong></span></div>
                            <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-muted-foreground"/> <span>Likes: <strong>{boost.analytics?.likes || 0}</strong></span></div>
                            <div className="flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-muted-foreground"/> <span>Clicks: <strong>{boost.analytics?.clicks || 0}</strong></span></div>
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const DataTableSkeleton = () => (
    <div className="rounded-md border">
        <Table>
            <TableHeader>
                <TableRow>
                    {Array.from({ length: 5 }).map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-full" /></TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
);

export default function SellerAdsPage() {
    const { user } = useUser();
    const [campaigns, setCampaigns] = React.useState<BoostRequest[]>([]);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const [selectedBoost, setSelectedBoost] = React.useState<BoostRequest | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
    const { toast } = useToast();

    const fetchCampaigns = React.useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/seller/campaigns', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch campaigns');
            }
            
            const { campaigns: fetchedCampaigns, products: fetchedProducts } = await response.json();
            setCampaigns(fetchedCampaigns);
            setProducts(fetchedProducts);

        } catch (error: any) {
            console.error("Fetch campaigns error:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not fetch your campaigns.',
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    const handleRefreshStats = React.useCallback(async (boostId: string) => {
        if (!user) return;
        toast({ title: "Refreshing stats from TikTok..." });
        try {
            const token = await user.getIdToken();
            const response = await fetch(`/api/admin/boosts/${boostId}/refresh`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                 const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to refresh stats.');
            }
            const updatedBoost = await response.json();
            
            // Update local state
            setCampaigns(prev => prev.map(c => c.id === boostId ? updatedBoost : c));
            setSelectedBoost(updatedBoost); // Also update the selected boost if it's being viewed
            toast({ title: "Stats Updated!", description: "Latest analytics have been fetched." });

        } catch (error: any) {
             toast({ variant: "destructive", title: "Refresh Failed", description: error.message });
        }
    }, [user, toast]);

    React.useEffect(() => {
        if (user) {
            fetchCampaigns();
        }
    }, [user, fetchCampaigns]);

    const stats = React.useMemo(() => {
      const initialStats = { totalViews: 0, totalLikes: 0, totalClicks: 0, totalSpent: 0 };
      if (!campaigns) return initialStats;
      return campaigns.reduce((acc, c) => {
          acc.totalViews += c.analytics?.views || 0;
          acc.totalLikes += c.analytics?.likes || 0;
          acc.totalClicks += c.analytics?.clicks || 0;
          if(c.status !== 'draft' && c.status !== 'rejected') {
            acc.totalSpent += c.pointsPaid || 0;
          }
          return acc;
      }, initialStats);
    }, [campaigns]);
  
    const handleViewDetails = (boost: BoostRequest) => {
        setSelectedBoost(boost);
        setIsDetailsOpen(true);
    };

    const columns: ColumnDef<BoostRequest>[] = [
    {
        accessorKey: 'videoUrl',
        header: 'Campaign',
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                 <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                    <video
                        src={row.original.videoUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        onMouseOver={e => e.currentTarget.play()}
                        onMouseOut={e => e.currentTarget.pause()}
                    />
                </div>
                <span className="font-medium truncate max-w-xs">{row.original.caption || 'No caption'}</span>
            </div>
        ),
    },
    {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
        const status = row.original.status;
        const variant: 'default' | 'secondary' | 'outline' | 'destructive' = {
            active: 'default',
            approved: 'default',
            rejected: 'destructive',
            pending: 'secondary',
            draft: 'secondary',
            completed: 'outline'
        }[status] as any;
        return <Badge variant={variant} className={`capitalize ${status === 'active' || status === 'approved' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
        },
    },
    {
        accessorKey: 'pointsPaid',
        header: 'Cost (Points)',
        cell: ({ row }) => `${row.original.pointsPaid.toLocaleString()} pts`,
    },
    {
        accessorKey: 'analytics.clicks',
        header: 'Clicks',
        cell: ({ row }) => (row.original.analytics?.clicks || 0).toLocaleString(),
    },
    {
        id: 'actions',
        cell: ({ row }) => (
            <Button variant="outline" size="sm" onClick={() => handleViewDetails(row.original)}>View Details</Button>
        ),
    },
    ];

  const table = useReactTable({
    data: campaigns || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    TikTok Boost Dashboard
                </h1>
                <p className="text-muted-foreground">Promote your product videos on TikTok to reach more customers.</p>
            </div>
            <div className="flex gap-4">
                 <Card>
                    <CardContent className="p-3 flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-md">
                            <BadgeCent className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Your Balance</p>
                            {isProfileLoading ? (
                                <Skeleton className="h-6 w-20" />
                            ) : (
                                <p className="text-lg font-bold">{(userProfile?.aiPoints || 0).toLocaleString()}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                 <CreateBoostDialog products={products || []} onBoostCreated={fetchCampaigns} userProfile={userProfile} />
            </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard isLoading={isLoading} title="Total Views" value={stats.totalViews.toLocaleString()} icon={Eye} />
            <StatCard isLoading={isLoading} title="Total Clicks" value={stats.totalClicks.toLocaleString()} icon={MousePointerClick} />
            <StatCard isLoading={isLoading} title="Total Likes" value={stats.totalLikes.toLocaleString()} icon={Heart} />
            <StatCard isLoading={isLoading} title="Total Points Spent" value={`${stats.totalSpent.toLocaleString()} pts`} icon={BarChart2} />
        </div>

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
                            <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                            ))}
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                            You haven't created any TikTok boosts yet.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        )}
        <ViewDetailsDialog 
            boost={selectedBoost} 
            isOpen={isDetailsOpen} 
            onOpenChange={setIsDetailsOpen} 
            onRefresh={handleRefreshStats}
        />
      </div>
    </SellerLayout>
  );
}
