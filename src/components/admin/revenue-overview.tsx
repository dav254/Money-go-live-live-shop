'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueData {
    source: string;
    amount: number;
    fill: string;
}

interface RevenueOverviewProps {
    totalRevenue: number;
    percentageChange: string;
    revenueBreakdown: RevenueData[];
    isLoading: boolean;
}

const RevenueBar = ({ source, amount, total, fill }: { source: string, amount: number, total: number, fill: string }) => {
    const widthPercentage = total > 0 ? (amount / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-muted-foreground">{source}</span>
                <span className="text-sm font-semibold">${amount.toLocaleString()}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
                <div className={`${fill} h-2.5 rounded-full`} style={{ width: `${widthPercentage}%` }}></div>
            </div>
        </div>
    );
}

export const RevenueOverview = ({ totalRevenue, percentageChange, revenueBreakdown, isLoading }: RevenueOverviewProps) => {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Revenue Overview</CardTitle>
                    <CardDescription>Your revenue breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-1/4 mb-6" />
                    <div className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                             <div key={i}>
                                <Skeleton className="h-5 w-full mb-2" />
                                <Skeleton className="h-2.5 w-full rounded-full" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    const totalBreakdownRevenue = revenueBreakdown.reduce((sum, item) => sum + item.amount, 0);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Your revenue breakdown for this month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-3xl font-bold">${totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{percentageChange}</p>
                </div>
                <div className="space-y-4">
                    {revenueBreakdown.map(item => (
                        <RevenueBar 
                            key={item.source}
                            source={item.source}
                            amount={item.amount}
                            total={totalBreakdownRevenue}
                            fill={item.fill}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};