'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Hourglass, Loader, CheckCircle, Truck, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PipelineStatus {
    status: string;
    count: number;
    icon: React.ElementType;
}

interface FulfillmentPipelineProps {
    pipelineData: PipelineStatus[];
    isLoading: boolean;
}

const StatusItem = ({ status, count, icon: Icon }: PipelineStatus) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{status}</span>
        </div>
        <span className="font-semibold">{count}</span>
    </div>
);

export const FulfillmentPipeline = ({ pipelineData, isLoading }: FulfillmentPipelineProps) => {
     if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Fulfillment Pipeline</CardTitle>
                    <CardDescription>A snapshot of your order statuses.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-5 w-8" />
                            </div>
                        ))}
                    </div>
                    <Button variant="outline" className="w-full justify-center gap-2" disabled>
                        View Orders <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Fulfillment Pipeline</CardTitle>
                <CardDescription>A snapshot of your order statuses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    {pipelineData.map(item => <StatusItem key={item.status} {...item} />)}
                </div>
                <Button asChild variant="outline" className="w-full justify-center gap-2">
                    <Link href="/dashboard/admin/orders/all">
                        View Orders <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
};
