
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
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  PlusCircle,
  BarChart2,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  ShieldCheck,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type AdCampaign = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  spend: number;
  clicks: number;
  cpc: number; // Cost Per Click
  conversions: number;
};

// --- Mock Data ---
const mockAdCampaigns: AdCampaign[] = [
  { id: 'ad-1', name: 'Summer Handbag Sale', status: 'active', spend: 450.75, clicks: 1250, cpc: 0.36, conversions: 80 },
  { id: 'ad-2', name: 'Tech Gadget Launch - Q3', status: 'completed', spend: 1200.00, clicks: 3400, cpc: 0.35, conversions: 150 },
  { id: 'ad-3', name: 'Holiday Fashion Promo', status: 'paused', spend: 200.00, clicks: 500, cpc: 0.40, conversions: 25 },
  { id: 'ad-4', name: 'New Year, New Gear', status: 'draft', spend: 0, clicks: 0, cpc: 0, conversions: 0 },
];

const mockStats = {
    totalSpend: 1850.75,
    totalClicks: 5150,
    totalConversions: 255,
    avgCpc: 0.36
}
// --- End Mock Data ---


const StatCard = ({ title, value, icon: Icon, description, color }: { title: string, value: string, icon: React.ElementType, description?: string, color?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const CreateAdDialog = () => {
    const { toast } = useToast();
    const [campaignCost, setCampaignCost] = React.useState(4200);

    const handleDurationChange = (value: string) => {
        const costs: { [key: string]: number } = {
            '3': 4200,
            '7': 7200,
            '14': 13200,
        };
        setCampaignCost(costs[value] || 4200);
    };

    const handleSubmit = () => {
        toast({
            title: "Campaign Submitted for Review (Mock)",
            description: "Your ad campaign request has been sent to the admin team for approval."
        });
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Create New Ad Campaign</DialogTitle>
                <DialogDescription>
                    Select a product and campaign duration, then submit for admin review.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Select Product to Promote</Label>
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose one of your products..." />
                        </SelectTrigger>
                        <SelectContent>
                            {/* In a live version, this would be populated with the seller's actual products */}
                            <SelectItem value="prod-1">Classic Leather Handbag</SelectItem>
                            <SelectItem value="prod-2">Urban Explorer Sneakers</SelectItem>
                             <SelectItem value="prod-3">Gourmet Pasta Kit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Campaign Duration</Label>
                    <Select defaultValue="3" onValueChange={handleDurationChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose a duration..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3">3 Days</SelectItem>
                            <SelectItem value="7">7 Days (1 Week)</SelectItem>
                            <SelectItem value="14">14 Days (2 Weeks)</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Your ad budget will be spread evenly over this period.</p>
                </div>

                <Alert variant="default" className="bg-blue-950/50 border-blue-500/30">
                  <ShieldCheck className="h-4 w-4 !text-blue-400" />
                  <AlertTitle className="font-semibold !text-blue-300">TikTok Ad Guidelines</AlertTitle>
                  <AlertDescription className="text-blue-300/80">
                    <ul className="list-disc pl-4 space-y-1 text-xs mt-2">
                        <li>**No Misleading Claims:** Do not guarantee results.</li>
                        <li>**High-Quality Video:** Use clear, well-lit video.</li>
                        <li>**No Copyrighted Music:** Use royalty-free audio.</li>
                    </ul>
                  </AlertDescription>
                </Alert>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                <DialogClose asChild><Button onClick={handleSubmit}>Create Campaign ({campaignCost.toLocaleString()} Points)</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

export const columns: ColumnDef<AdCampaign>[] = [
  {
    accessorKey: 'name',
    header: 'Campaign',
    cell: ({ row }) => <div className="font-semibold">{row.original.name}</div>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      const variant: 'default' | 'secondary' | 'outline' = {
        active: 'default',
        completed: 'outline',
        paused: 'secondary',
        draft: 'secondary',
      }[status] as any;
      return <Badge variant={variant} className={`capitalize ${status === 'active' ? 'bg-green-600/80' : ''}`}>{status}</Badge>;
    },
  },
  {
    accessorKey: 'spend',
    header: 'Spend (USD)',
    cell: ({ row }) => `$${row.original.spend.toLocaleString()}`,
  },
  {
    accessorKey: 'clicks',
    header: 'Clicks',
  },
  {
    accessorKey: 'conversions',
    header: 'Conversions',
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
          <DropdownMenuItem>View Performance</DropdownMenuItem>
          <DropdownMenuItem>Pause Campaign</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Delete Campaign</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function SellerAdsPage() {
  const table = useReactTable({
    data: mockAdCampaigns,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Dialog>
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    My Ad Campaigns
                </h1>
                <DialogTrigger asChild>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Create New Ad</Button>
                </DialogTrigger>
            </div>
            <CreateAdDialog />
        </Dialog>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Spend" value={`$${mockStats.totalSpend.toLocaleString()}`} icon={DollarSign} description="Lifetime" />
            <StatCard title="Total Clicks" value={mockStats.totalClicks.toLocaleString()} icon={MousePointerClick} description="Lifetime" />
            <StatCard title="Conversions" value={mockStats.totalConversions.toLocaleString()} icon={TrendingUp} description="Lifetime" />
            <StatCard title="Average CPC" value={`$${mockStats.avgCpc.toFixed(2)}`} icon={BarChart2} description="Lifetime" />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    You have not created any ad campaigns.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </SellerLayout>
  );
}
