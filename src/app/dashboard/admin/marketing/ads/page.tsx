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
  DialogTrigger,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Pencil, Trash2, Zap, CheckCircle, XCircle, Rocket } from 'lucide-react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

// Define the AdCampaign type locally for the mock node
interface AdCampaign {
    id: string;
    sellerId: string;
    productName: string;
    productImageUrl: string;
    budget: number;
    spend: number;
    clicks: number;
    conversions: number;
    status: 'active' | 'paused' | 'completed' | 'draft';
    startDate: string;
}

const MOCK_CAMPAIGNS: AdCampaign[] = [
    {
        id: 'ad_1',
        sellerId: 'node_alpha_99',
        productName: 'Cyber-Streetwear 2026',
        productImageUrl: 'https://picsum.photos/seed/cyber/400/400',
        budget: 1500,
        spend: 1240,
        clicks: 4500,
        conversions: 120,
        status: 'active',
        startDate: new Date().toISOString(),
    },
    {
        id: 'ad_2',
        sellerId: 'node_beta_42',
        productName: 'Minimalist Tech Hub',
        productImageUrl: 'https://picsum.photos/seed/tech/400/400',
        budget: 800,
        spend: 800,
        clicks: 2100,
        conversions: 45,
        status: 'completed',
        startDate: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
        id: 'ad_3',
        sellerId: 'node_gamma_12',
        productName: 'Artisan Coffee Roasts',
        productImageUrl: 'https://picsum.photos/seed/coffee/400/400',
        budget: 500,
        spend: 150,
        clicks: 800,
        conversions: 12,
        status: 'paused',
        startDate: new Date(Date.now() - 86400000).toISOString(),
    }
];

const statusConfig = {
    active: { variant: 'default' as const, icon: Zap, className: 'bg-green-600/80 hover:bg-green-600/70' },
    paused: { variant: 'secondary' as const, icon: Zap, className: 'bg-yellow-500/80 hover:bg-yellow-500/70' },
    completed: { variant: 'outline' as const, icon: CheckCircle, className: 'opacity-50' },
    draft: { variant: 'outline' as const, icon: XCircle, className: '' },
};


const CampaignForm = ({ campaign, onSave, onCancel }: { campaign?: AdCampaign | null, onSave: (data: Partial<AdCampaign>) => void, onCancel: () => void }) => {
    const [sellerId, setSellerId] = React.useState(campaign?.sellerId || '');
    const [productName, setProductName] = React.useState(campaign?.productName || '');
    const [budget, setBudget] = React.useState(campaign?.budget || 0);
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!sellerId || !productName || budget <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Signal', description: 'Identifier, Product, and Budget nodes required.' });
            return;
        }
        onSave({
            id: campaign?.id,
            sellerId,
            productName,
            budget,
            status: campaign?.status || 'active',
        });
    };

    return (
         <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
                <Label htmlFor="seller-id" className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Merchant Node Identifier</Label>
                <Input id="seller-id" value={sellerId} onChange={e => setSellerId(e.target.value)} placeholder="e.g. node_delta_88" className="bg-black/40 border-white/5 h-12" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="product-name" className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Asset Designation</Label>
                <Input id="product-name" value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Premium Leather Belt" className="bg-black/40 border-white/5 h-12" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="budget" className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Allocation (USD)</Label>
                <Input id="budget" type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} placeholder="e.g. 500" className="bg-black/40 border-white/5 h-12" />
            </div>
            <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Abort</Button></DialogClose>
                <Button type="submit" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8">Save Sequence</Button>
            </DialogFooter>
        </form>
    );
};

export default function AdminAdsPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingCampaign, setEditingCampaign] = React.useState<AdCampaign | null>(null);
  const [campaigns, setCampaigns] = React.useState<AdCampaign[]>(MOCK_CAMPAIGNS);
  const { toast } = useToast();

  const handleSave = (data: Partial<AdCampaign>) => {
      if (data.id) {
          setCampaigns(prev => prev.map(c => c.id === data.id ? { ...c, ...data } as AdCampaign : c));
          toast({ title: 'SIGNAL UPDATED', description: `Campaign sequence ${data.id} has been modified.` });
      } else {
          const newCampaign: AdCampaign = {
              ...data,
              id: `ad_${Math.random().toString(36).substr(2, 9)}`,
              productImageUrl: 'https://picsum.photos/seed/new-ad/400/400',
              spend: 0,
              clicks: 0,
              conversions: 0,
              startDate: new Date().toISOString(),
          } as AdCampaign;
          setCampaigns(prev => [newCampaign, ...prev]);
          toast({ title: 'CAMPAIGN DEPLOYED', description: 'New promotion signal is now active.' });
      }
      setIsFormOpen(false);
      setEditingCampaign(null);
  };
  
  const handleDelete = (id: string) => {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast({ title: 'CAMPAIGN TERMINATED', description: `Sequence ${id} has been purged from the grid.` });
  };
  
  const handleEdit = (campaign: AdCampaign) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };


  const columns: ColumnDef<AdCampaign>[] = [
    {
        accessorKey: 'productName',
        header: 'Promotion Node',
        cell: ({ row }) => (
            <div className="flex items-center gap-4">
                <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black shrink-0">
                    <Image src={row.original.productImageUrl || 'https://picsum.photos/seed/ad-product/100'} alt={row.original.productName || 'Ad'} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                    <div className="font-black text-xs uppercase tracking-tight text-white truncate">{row.original.productName}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">#{row.original.sellerId}</div>
                </div>
            </div>
        )
    },
    {
        accessorKey: 'status',
        header: 'Signal',
        cell: ({ row }) => {
            const status = row.original.status;
            const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
            const Icon = config.icon;
            return (
                <Badge variant={config.variant} className={cn("px-3 py-1 font-black text-[9px] uppercase tracking-widest border-none", config.className)}>
                    <Icon className="mr-1.5 h-3 w-3" />
                    {status}
                </Badge>
            )
        }
    },
    {
        accessorKey: 'budget',
        header: 'Allocation',
        cell: ({ row }) => <div className="font-black text-sm text-foreground">${row.original.budget.toLocaleString()}</div>
    },
    {
        accessorKey: 'spend',
        header: 'Utilization',
        cell: ({ row }) => {
            const percentage = Math.round((row.original.spend / row.original.budget) * 100);
            return (
                <div className="space-y-1.5 w-24">
                    <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground tracking-tighter">
                        <span>${row.original.spend.toLocaleString()}</span>
                        <span>{percentage}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: 'clicks',
        header: () => <div className="text-right">Engagement</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <div className="font-black text-xs">{(row.original.clicks || 0).toLocaleString()}</div>
                <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">CLICKS</div>
            </div>
        )
    },
     {
        accessorKey: 'conversions',
        header: () => <div className="text-right">Yield</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <div className="font-black text-xs text-primary">{(row.original.conversions || 0).toLocaleString()}</div>
                <div className="text-[8px] font-bold text-primary/60 uppercase tracking-widest">SALES</div>
            </div>
        )
    },
    {
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-white/5" onClick={() => handleEdit(row.original)}><Pencil className="h-4 w-4 text-neutral-400" /></Button>
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive text-neutral-600" onClick={() => handleDelete(row.original.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )
    }
];


  const table = useReactTable({
    data: campaigns,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
                <h1 className="font-headline text-4xl font-black uppercase tracking-tighter text-white leading-none">
                    Ads Management
                </h1>
                <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-2 flex items-center gap-2">
                    <Rocket className="h-3 w-3 text-primary" /> 
                    High-Velocity Marketing Protocol • Local Node
                </p>
            </div>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => setEditingCampaign(null)} className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20">
                        <PlusCircle className="mr-2 h-4 w-4" /> Initialize Campaign
                    </Button>
                </DialogTrigger>
                 <DialogContent className="sm:max-w-md bg-neutral-950 border-white/10 rounded-[2rem] shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-black text-xl uppercase tracking-tighter text-white">{editingCampaign ? 'Modify Signal' : 'Deploy New Signal'}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Adjust the parameters for this promotional node.</DialogDescription>
                    </DialogHeader>
                    <CampaignForm campaign={editingCampaign} onSave={handleSave} onCancel={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>

        <div className="rounded-[2.5rem] border border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    {table.getHeaderGroups().map(hg => (
                        <TableRow key={hg.id} className="border-white/5 hover:bg-transparent">
                            {hg.headers.map(h => (
                                <TableHead key={h.id} className="text-[10px] font-black uppercase tracking-widest text-neutral-500 h-14 px-6">
                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length > 0 ? (
                        table.getRowModel().rows.map(row => (
                            <TableRow key={row.id} className="border-white/5 hover:bg-white/5 transition-colors group h-20">
                                {row.getVisibleCells().map(cell => (
                                    <TableCell key={cell.id} className="px-6">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-64 text-center">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <Rocket className="h-12 w-12 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">The marketing grid is currently silent.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
