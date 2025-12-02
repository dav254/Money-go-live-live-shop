
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Image from 'next/image';

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
  DropdownMenuSeparator,
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
import type { BoostRequest, TargetingOptions, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';

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

const CreateBoostDialog = ({ onBoostCreated }: { onBoostCreated: () => void }) => {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [videoFile, setVideoFile] = React.useState<File | null>(null);
    const [caption, setCaption] = React.useState('');
    const [durationDays, setDurationDays] = React.useState(3);

    const pointsCost = durationDays * 100;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
        } else {
            toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please select a valid video file.' });
        }
    };

    const handleSubmit = async () => {
        if (!videoFile) {
            toast({ variant: 'destructive', title: 'Please upload a video file.' });
            return;
        }
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const videoUrl = `https://storage.example.com/${user.uid}/${videoFile.name}`;

            const payload = {
                videoUrl,
                caption,
                durationDays,
                pointsCost,
                target: { counties: ['Nairobi'], age: '18-34', interests: ['shopping'] },
            };

            const token = await user.getIdToken();

            const response = await fetch('/api/seller/boosts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "An unknown error occurred.");
            }

            toast({
                title: "Boost Submitted for Review",
                description: "Your campaign is pending admin approval."
            });
            onBoostCreated();

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: error.message,
            });
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
                        Upload a video, set your campaign details, and pay with points to boost your product on TikTok.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="video-upload">Video File</Label>
                        <div className="flex items-center justify-center w-full">
                            <label htmlFor="video-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    {videoFile ? <Video className="w-8 h-8 mb-2 text-primary" /> : <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />}
                                    <p className="mb-1 text-sm text-muted-foreground">
                                        {videoFile ? <span className="font-semibold">{videoFile.name}</span> : <span>Click to upload a video</span>}
                                    </p>
                                </div>
                                <Input id="video-upload" type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                            </label>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="caption">Caption</Label>
                        <Textarea id="caption" placeholder="e.g., 'Check out our new summer collection! #summerfashion'" value={caption} onChange={(e) => setCaption(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Campaign Duration</Label>
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
                    <Button onClick={handleSubmit} disabled={isSubmitting || !videoFile}>
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

export const columns: ColumnDef<BoostRequest>[] = [
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
        approved: 'default',
        rejected: 'destructive',
        pending: 'secondary',
      }[status] as any;
      return <Badge variant={variant} className={`capitalize ${status === 'approved' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
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
    cell: ({ row }) => row.original.analytics.clicks.toLocaleString(),
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
          <DropdownMenuItem disabled={row.original.status !== 'approved'}>View on TikTok</DropdownMenuItem>
          <DropdownMenuItem>View Details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function SellerTikTokBoostPage() {
  const { user } = useUser();
  const [boosts, setBoosts] = React.useState<BoostRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const { toast } = useToast();
  
  const fetchBoostData = React.useCallback(async () => {
      if (!user) {
          setIsLoading(false);
          return;
      }
      setIsLoading(true);
      try {
          const token = await user.getIdToken();
          const response = await fetch('/api/seller/boosts', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!response.ok) {
               const errorData = await response.json();
               throw new Error(errorData.message || 'Failed to fetch boost campaigns');
          }
          const data = await response.json();
          setBoosts(data);
      } catch (error: any) {
          toast({
              variant: 'destructive',
              title: 'Error Loading Data',
              description: error.message
          });
          console.error(error);
      } finally {
          setIsLoading(false);
      }
  }, [user, toast]);

  React.useEffect(() => {
    fetchBoostData();
  }, [fetchBoostData]);

  const stats = React.useMemo(() => {
      const initialStats = { totalViews: 0, totalLikes: 0, totalClicks: 0, totalSpent: 0 };
      if (!boosts) return initialStats;
      return boosts.reduce((acc, c) => {
          acc.totalViews += c.analytics.views;
          acc.totalLikes += c.analytics.likes;
          acc.totalClicks += c.analytics.clicks;
          if(c.status === 'approved') acc.totalSpent += c.pointsPaid;
          return acc;
      }, initialStats);
  }, [boosts]);

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
            <CreateBoostDialog onBoostCreated={fetchBoostData} />
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
