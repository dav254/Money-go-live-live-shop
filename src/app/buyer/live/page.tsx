
'use client';

import React from 'react';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioTower } from 'lucide-react';

const JoinLivePage = () => {
    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">Live Studio</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Currently Live</CardTitle>
                        <CardDescription>Sellers who are live right now.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                        <div className="flex h-48 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                            <RadioTower className="h-12 w-12 text-muted-foreground" />
                            <h3 className="text-xl font-semibold">Coming Soon!</h3>
                            <p className="text-muted-foreground">The live shopping experience is being polished. Check back soon!</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </BuyerLayout>
    );
};

export default JoinLivePage;
