'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Shield, ArrowRight, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TrustAndSafetyProps {
    items: {
        label: string;
        count: number;
    }[];
    totalItems: number;
    isLoading: boolean;
}

export const TrustAndSafety = ({ items, totalItems, isLoading }: TrustAndSafetyProps) => {

    if (isLoading) {
        return (
             <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                         {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-5 w-8" />
                            </div>
                        ))}
                    </div>
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Trust & Safety</CardTitle>
                <CardDescription className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="font-bold text-destructive">{totalItems} items need attention</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    {items.map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                            <span className="font-semibold">{item.count}</span>
                        </div>
                    ))}
                </div>
                <Button asChild variant="secondary" className="w-full">
                    <Link href="#">OPEN SAFETY CENTER <ArrowRight className="h-4 w-4 ml-2" /></Link>
                </Button>
            </CardContent>
        </Card>
    );
};
