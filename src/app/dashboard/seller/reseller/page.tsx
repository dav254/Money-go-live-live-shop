
'use client';

import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, Users, Trophy, BarChart2, Share2, Target, Percent, PlusCircle, Trash2, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React, { useMemo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow, subDays } from 'date-fns';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';


interface ResellerStat {
  id: string;
  name: string;
  avatar: string;
  sales: number;
  commission: number;
}

const mockTopResellers: ResellerStat[] = [
    { id: 'reseller-1', name: 'John Doe', avatar: 'https://picsum.photos/seed/john/40', sales: 152, commission: 450.75 },
    { id: 'reseller-2', name: 'Jane Smith', avatar: 'https://picsum.photos/seed/jane/40', sales: 121, commission: 380.50 },
    { id: 'reseller-3', name: 'Mike Williams', avatar: 'https://picsum.photos/seed/mike/40', sales: 98, commission: 290.00 },
];

const mockCommissionPayoutData = [
    { date: 'Week 1', 'Commission Paid': 250 },
    { date: 'Week 2', 'Commission Paid': 450 },
    { date: 'Week 3', 'Commission Paid': 380 },
    { date: 'This Week', 'Commission Paid': 610 },
];

const mockAlerts = [
    {
        type: 'boost',
        title: "Top Performer: 'Classic Handbag'",
        description: "This item is being shared a lot but has a low commission rate (5%). Consider increasing it to 10-15% to motivate resellers even more.",
        icon: TrendingUp,
        color: 'text-green-400'
    },
    {
        type: 'stale',
        title: "Stale Product: 'Winter Scarf'",
        description: "This product hasn't been shared by any resellers in over 30 days. Consider pausing it or creating new video content to promote it.",
        icon: AlertTriangle,
        color: 'text-yellow-400'
    }
]

const TopResellersTable = () => {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Reseller</TableHead>
                    <TableHead className="text-center">Sales Made</TableHead>
                    <TableHead className="text-right">Commission Earned (USD)</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                 {mockTopResellers.length > 0 ? (
                    mockTopResellers.map((reseller, index) => (
                        <TableRow key={reseller.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-lg w-6 text-center">{index + 1}</span>
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={reseller.avatar} />
                                        <AvatarFallback>{reseller.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{reseller.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-medium">{reseller.sales}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">${reseller.commission.toFixed(2)}</TableCell>
                        </TableRow>
                    ))
                 ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                            No sales from resellers yet.
                        </TableCell>
                    </TableRow>
                 )}
            </TableBody>
        </Table>
    );
};


const mockCommissionTiers = [
    { id: 'tier-1', salesTarget: 20, commissionBoost: 5, description: "Sell 20 items in a month to get a +5% commission boost." },
    { id: 'tier-2', salesTarget: 50, commissionBoost: 10, description: "Sell 50 items in a month to get a +10% commission boost and a 'Top Reseller' badge." },
];

const CommissionTiers = () => {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy />
                            Commission Tiers
                        </CardTitle>
                        <CardDescription>
                            Create performance-based tiers to incentivize your top resellers.
                        </CardDescription>
                    </div>
                     <Dialog>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Tier</Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>Create New Commission Tier</DialogTitle>
                                <DialogDescription>Set a sales goal to unlock a higher commission rate.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="sales-target" className="text-right">Sales Target</Label>
                                    <Input id="sales-target" type="number" defaultValue="20" className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="commission-boost" className="text-right">Commission Boost (%)</Label>
                                    <Input id="commission-boost" type="number" defaultValue="5" className="col-span-3" />
                                </div>
                            </div>
                             <DialogFooter>
                                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit">Create Tier</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sales Target (monthly)</TableHead>
                            <TableHead>Commission Boost</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mockCommissionTiers.map(tier => (
                            <TableRow key={tier.id}>
                                <TableCell>
                                    <p className="font-medium">{tier.salesTarget} items</p>
                                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                                </TableCell>
                                <TableCell className="font-semibold text-green-500">+{tier.commissionBoost}%</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {mockCommissionTiers.length === 0 && (
                             <TableRow>
                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                                    No commission tiers created yet.
                                </TableCell>
                            </TableRow>
                         )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


export default function ResellerCenterPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reseller Center
        </h1>
        
        <Tabs defaultValue="analytics" className="space-y-4">
            <TabsList>
                <TabsTrigger value="analytics"><BarChart2 className="mr-2 h-4 w-4"/>Analytics</TabsTrigger>
                <TabsTrigger value="commissions"><BadgePercent className="mr-2 h-4 w-4"/>Commission Rules</TabsTrigger>
                <TabsTrigger value="tiers"><Trophy className="mr-2 h-4 w-4" />Commission Tiers</TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="space-y-6">
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lightbulb /> Performance Alerts</CardTitle>
                        <CardDescription>AI-powered suggestions to optimize your reseller program.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         {mockAlerts.map(alert => (
                             <Alert key={alert.title} variant={alert.type === 'stale' ? 'destructive' : 'default'} className="bg-primary/5">
                                 <alert.icon className={`h-4 w-4 ${alert.color}`} />
                                 <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
                                 <AlertDescription>
                                     {alert.description}
                                     <Button variant="link" className="p-0 h-auto ml-2">Take Action</Button>
                                 </AlertDescription>
                             </Alert>
                         ))}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                            <Target className="h-4 w-4 text-muted-foreground"/>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">5.8%</div>
                            <p className="text-xs text-muted-foreground">Average from all reseller links</p>
                            <Progress value={5.8} className="mt-2 h-2" />
                        </CardContent>
                    </Card>
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BarChart2 /> Commission Payouts</CardTitle>
                            <CardDescription>Total commission paid to all resellers in the last 4 weeks.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mockCommissionPayoutData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`}/>
                                    <RechartsTooltip cursor={{ fill: 'hsla(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                                    <Bar dataKey="Commission Paid" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Top Performing Resellers</CardTitle>
                        <CardDescription>This leaderboard shows which of your resellers are driving the most sales.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TopResellersTable />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="commissions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BadgePercent />
                      Set Product Commission Rates
                    </CardTitle>
                    <CardDescription>Set the percentage a reseller will earn for selling each product. A rate of 0% means the product is not available for reselling.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CommissionSettingsTable />
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="tiers">
                <CommissionTiers />
            </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
    
