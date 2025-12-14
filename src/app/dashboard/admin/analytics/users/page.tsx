
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { format, subDays } from 'date-fns';

const chartConfig = {
  users: {
    label: 'New Users',
    color: 'hsl(var(--primary))',
  },
};

const StatCard = ({ title, value, isLoading }: { title: string, value: string, isLoading: boolean }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);

export default function UserAnalyticsPage() {
    const firestore = useFirestore();
    const usersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles')), [firestore]);
    const { data: allUsers, isLoading } = useCollection<UserProfile>(usersQuery);

    const userStats = useMemo(() => {
        if (!allUsers) return { total: 0, buyers: 0, sellers: 0, resellers: 0 };
        return {
            total: allUsers.length,
            buyers: allUsers.filter(u => u.userRole === 'buyer').length,
            sellers: allUsers.filter(u => u.userRole === 'seller').length,
            resellers: allUsers.filter(u => u.userRole === 'reseller').length,
        }
    }, [allUsers]);

    const chartData = useMemo(() => {
        const data: { date: string; users: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i);
            data.push({ date: format(date, 'MMM d'), users: 0 });
        }

        if (allUsers) {
            allUsers.forEach(user => {
                const joinDate = user.joinDate ? new Date(user.joinDate) : new Date();
                const dateStr = format(joinDate, 'MMM d');
                const dayData = data.find(d => d.date === dateStr);
                if (dayData) {
                    dayData.users += 1;
                }
            });
        }
        return data;
    }, [allUsers]);

    return (
        <AdminLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">User Analytics</h1>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Users" value={userStats.total.toLocaleString()} isLoading={isLoading} />
                    <StatCard title="Total Buyers" value={userStats.buyers.toLocaleString()} isLoading={isLoading} />
                    <StatCard title="Total Sellers" value={userStats.sellers.toLocaleString()} isLoading={isLoading} />
                    <StatCard title="Total Resellers" value={userStats.resellers.toLocaleString()} isLoading={isLoading} />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>New User Signups</CardTitle>
                        <CardDescription>New users in the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-80 w-full" /> : (
                             <ChartContainer config={chartConfig} className="h-80 w-full">
                                <RechartsBarChart data={chartData}>
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                    <YAxis dataKey="users" tickLine={false} axisLine={false} tickMargin={8} />
                                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                    <Bar dataKey="users" fill="var(--color-users)" radius={4} />
                                </RechartsBarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}

