'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityItem {
    icon: React.ReactNode;
    description: string;
    details: string;
    time: string;
}

interface RecentActivityProps {
    activities: ActivityItem[];
    isLoading: boolean;
}

const ActivityItem = ({ icon, description, details, time }: ActivityItem) => (
  <div className="flex items-start gap-4">
    <div className="bg-muted rounded-full p-2">{icon}</div>
    <div className="flex-grow">
        <p className="font-semibold text-sm">{description}</p>
        <p className="text-muted-foreground text-xs">{details}</p>
    </div>
    <p className="text-muted-foreground text-xs whitespace-nowrap">{time}</p>
  </div>
);

export const RecentActivity = ({ activities, isLoading }: RecentActivityProps) => {
     if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-grow space-y-2">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                            <Skeleton className="h-4 w-12" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Newspaper className="h-5 w-5" /> Recent Activity</CardTitle>
                <CardDescription>What just happened on the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {activities.map((activity, index) => (
                    <ActivityItem key={index} {...activity} />
                ))}
                 <Button asChild variant="outline" className="w-full">
                    <Link href="#">View All Activity <ArrowRight className="h-4 w-4 ml-2" /></Link>
                </Button>
            </CardContent>
        </Card>
    );
};
