
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Image from 'next/image';
import { Timestamp } from 'firebase/firestore';

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
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  PlusCircle,
  BarChart2,
  MousePointerClick,
  Heart,
  Eye,
  Loader2,
  ShieldCheck,
  UploadCloud,
  Video,
} from 'lucide-react';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { BoostRequest, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { createBoostRequest } from '@/app/actions/boost-actions';


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

const CreateBoostDialog = ({ products, onBoostCreated }: { products: Product[], onBoostCreated: () => void }) => {
    const { toast } = useToast();
    const { user } = useUser();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [selectedProductId, setSelectedProductId] = React.useState<string>('');
    const [caption, setCaption] = React.useState('');
    const [durationDays, setDurationDays] = React.useState(3);
    const [videoFile, setVideoFile] = React.useState<File | null>(null);
    const videoInputRef = React.useRef<HTMLInputElement>(null);

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const pointsCost = durationDays * 100;

    const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) { // 100MB limit
                toast({ variant: 'destructive', title: 'File too large', description: 'Please select a video file under 100MB.' });
                return;
            }
            setVideoFile(file);
        }
    };

    const handleSubmit = async () => {
        if (!videoFile) {
            toast({ variant: 'destructive', title: 'Please upload a video.' });
            return;
        }
        if (!selectedProduct) {
            toast({ variant: 'destructive', title: 'Please select a product to associate with this boost.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in.' });
            return;
        }

        setIsSubmitting(true);
        toast({ title: "Frontend Only", description: "This is a frontend-only demonstration. No backend action is being performed."});
        
        // ** BACKEND LOGIC DISABLED AS REQUESTED **
        // In a real scenario, we would upload the videoFile to Cloudinary, get the URL,
        // then call the createBoostRequest server action.
        
        // const token = await user.getIdToken();
        // createBoostRequest({
        //     productId: selectedProduct.id,
        //     videoUrl: 'https://placeholder.url/from/cloudinary',
        //     caption: caption,
        //     durationDays: durationDays,
        //     pointsCost: pointsCost,
        //     target: { counties: ['Nairobi'], age: '18-34', interests: ['fashion', 'shopping'] }
        // }).then(result => {
        //     if (result.success) {
        //         toast({ title: "Boost Submitted for Review", description: "Your campaign is now pending admin approval." });
        //         onBoostCreated();
        //     } else {
        //         throw new Error(result.error);
        //     }
        // }).catch(error => {
        //     toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        // }).finally(() => {
        //     setIsSubmitting(false);
        // });
        
        // Simulate a delay for demo purposes
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        onBoostCreated(); // This will close the dialog
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button><PlusCircle className="mr-2 h-4 w-4" /> Create TikTok Boost</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New TikTok Boost</DialogTitle>
                    <DialogDescription>
                        Promote your product video on TikTok. This action will deduct AI points from your account.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    
                    <div className="space-y-2">
                        <Label>1. Upload Video</Label>
                        <input type="file" accept="video/*" ref={videoInputRef} onChange={handleVideoFileChange} className="hidden" />
                        <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => videoInputRef.current?.click()}>
                           <UploadCloud className="h-6 w-6 mr-2" />
                           {videoFile ? `Selected: ${videoFile.name}` : 'Click to select a video'}
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label>2. Associate with a Product</Label>
                        <Select onValueChange={setSelectedProductId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a product..." />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="caption">3. Ad Caption</Label>
                        <Textarea id="caption" placeholder="e.g., 'Check out our new summer collection! #summerfashion'" value={caption} onChange={(e) => setCaption(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>4. Campaign Duration</Label>
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
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !videoFile || !selectedProduct}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Submit for Approval ({pointsCost} Points)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

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
    const firestore = useFirestore();

    const boostsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
          collection(firestore, 'boost_requests'), 
          where('sellerId', '==', user.uid),
        );
    }, [user, firestore]);

    const productsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
    }, [user, firestore]);

    const { data: boosts, isLoading: isLoadingBoosts } = useCollection<BoostRequest>(boostsQuery);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    const isLoading = isLoadingBoosts || isLoadingProducts;

    const stats = React.useMemo(() => {
      const initialStats = { totalViews: 0, totalLikes: 0, totalClicks: 0, totalSpent: 0 };
      if (!boosts) return initialStats;
      return boosts.reduce((acc, c) => {
          acc.totalViews += c.analytics?.views || 0;
          acc.totalLikes += c.analytics?.likes || 0;
          acc.totalClicks += c.analytics?.clicks || 0;
          if(c.status === 'active' || c.status === 'approved' || c.status === 'completed') acc.totalSpent += c.pointsPaid || 0;
          return acc;
      }, initialStats);
    }, [boosts]);
  
    const columns: ColumnDef<BoostRequest>[] = [
    {
        accessorKey: 'videoUrl',
        header: 'Campaign',
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                    <Video className="w-8 h-8 text-muted-foreground" />
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
                <DotsHorizontalIcon className="h-4 w-4" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem disabled>View on TikTok</DropdownMenuItem>
            <DropdownMenuItem>View Details</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        ),
    },
    ];

  const table = useReactTable({
    data: boosts || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                TikTok Boost Dashboard
            </h1>
            <CreateBoostDialog products={products || []} onBoostCreated={() => {}} />
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
      </div>
    </SellerLayout>
  );
}
