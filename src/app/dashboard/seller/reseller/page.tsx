
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
import { BadgePercent, Users, Trophy } from 'lucide-react';
import { CommissionSettingsTable } from '@/components/seller/commission-settings-table';
import { ManageResellersTable } from '@/components/seller/manage-resellers-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React, { useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

interface ResellerStat {
  id: string;
  name: string;
  avatar: string;
  sales: number;
  commission: number;
}

const TopResellersTable = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const [topResellers, setTopResellers] = React.useState<ResellerStat[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    const ordersQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'orders'),
            where('sellerId', '==', user.uid),
            where('resellerId', '!=', null)
        );
    }, [user, firestore]);

    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

    React.useEffect(() => {
        if (isLoadingOrders) return;
        if (!orders || orders.length === 0) {
            setIsLoading(false);
            return;
        }

        const processResellerData = async () => {
            const resellerStats: Record<string, { sales: number; commission: number }> = {};
            
            orders.forEach(order => {
                if (order.resellerId) {
                    if (!resellerStats[order.resellerId]) {
                        resellerStats[order.resellerId] = { sales: 0, commission: 0 };
                    }
                    resellerStats[order.resellerId].sales += 1;
                    resellerStats[order.resellerId].commission += order.resellerCommission || 0;
                }
            });

            const resellerIds = Object.keys(resellerStats);
            if (resellerIds.length === 0) {
                setIsLoading(false);
                return;
            }
            
            // Firestore 'in' queries are limited to 30 items. For larger scale, this would need batching.
            const usersQuery = query(collection(firestore, 'userProfiles'), where('id', 'in', resellerIds.slice(0, 30)));
            const usersSnapshot = await getDocs(usersQuery);
            const usersMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data() as UserProfile]));

            const populatedStats: ResellerStat[] = resellerIds.map(id => ({
                id: id,
                name: usersMap.get(id)?.fullName || 'Unknown Reseller',
                avatar: usersMap.get(id)?.profilePictureUrl || 'https://picsum.photos/seed/avatar/40',
                sales: resellerStats[id].sales,
                commission: resellerStats[id].commission,
            })).sort((a, b) => b.commission - a.commission);

            setTopResellers(populatedStats);
            setIsLoading(false);
        };

        processResellerData();

    }, [orders, isLoadingOrders, firestore]);


    if (isLoading) {
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
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                            <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    }

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
                 {topResellers.length > 0 ? (
                    topResellers.map((reseller, index) => (
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


export default function ResellerCenterPage() {
  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Reseller Center
        </h1>
        <Tabs defaultValue="commissions" className="space-y-4">
            <TabsList>
                <TabsTrigger value="commissions"><BadgePercent className="mr-2 h-4 w-4"/>Commission Rules</TabsTrigger>
                <TabsTrigger value="top-performers"><Trophy className="mr-2 h-4 w-4"/>Top Performers</TabsTrigger>
            </TabsList>
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
            <TabsContent value="top-performers" className="space-y-4">
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
        </Tabs>
      </div>
    </SellerLayout>
  );
}
