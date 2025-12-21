'use client';

import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';

export default function ResellerNotificationsPage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Notifications
                </h1>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bell /> Your Notifications</CardTitle>
                        <CardDescription>Updates on your commissions, new products, and more.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-48 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                            <p className="text-muted-foreground">You have no new notifications.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ResellerLayout>
    );
}
