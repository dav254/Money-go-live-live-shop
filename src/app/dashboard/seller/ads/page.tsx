
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
  BadgeCent,
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
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';


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

const CreateBoostDialog = ({ products, onBoostCreated, userProfile }: { products: Product[], onBoostCreated: () => void, userProfile: any }) => {
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
    const hasEnoughPoints = (userProfile?.aiPoints || 0) >= pointsCost;

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
        if (!videoFile || !selectedProduct || !user) return;
        if (!hasEnoughPoints) {
            toast({ variant: 'destructive', title: 'Insufficient Points', description: 'You do not have enough AI points for this boost.' });
            return;
        }

        setIsSubmitting(true);
        toast({ title: 'Submitting Boost Request...', description: 'Please wait while we upload your video.' });

        try {
            // This is a simplified, unsigned upload. A real app should use signed URLs from a backend.
            const formData = new FormData();
            formData.append('file', videoFile);
            formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESET || 'goearn-unsigned');
            formData.append('folder', 'boost_videos');

            const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/video/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                 const errorData = await uploadResponse.json();
                 throw new Error(errorData.error.message || 'Video upload failed.');
            }
            
            const uploadedData = await uploadResponse.json();
            
            const payload = {
                productId: selectedProductId,
                videoUrl: uploadedData.secure_url,
                caption: caption,
                durationDays: durationDays,
                pointsCost: pointsCost,
                target: { // Dummy targeting data
                    counties: ['Nairobi', 'Mombasa'],
                    age: '18-35',
                    interests: ['fashion', 'music'],
                },
            };
            
            const token = await user.getIdToken();
            const result = await fetch('/api/admin/boosts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!result.ok) {
                const errorData = await result.json();
                throw new Error(errorData.error || 'Failed to create boost request.');
            }

            toast({ title: 'Success!', description: 'Your boost request has been submitted for approval.' });
            onBoostCreated();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message });
        } finally {
            setIsSubmitting(false);
        }
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
                    <Button onClick={handleSubmit} disabled={isSubmitting || !videoFile || !selectedProduct || !hasEnoughPoints}>
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
    const router = useRouter();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

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

    const isLoading = isLoadingBoosts || isLoadingProducts || isProfileLoading;

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
                         <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/seller/ai-tools')}>Buy Points</Button>
                    </CardContent>
                </Card>
                 <CreateBoostDialog products={products || []} onBoostCreated={() => {}} userProfile={userProfile} />
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
      </div>
    </SellerLayout>
  );
}
