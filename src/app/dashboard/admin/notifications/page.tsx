'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';

export default function AdminNotificationsPage() {
    return (
        <AdminLayout>
            <div className="flex-1 space-y-4 p-8 pt-6">
                <h1 className="font-headline text-3xl font-bold tracking-tight">
                    Admin Notifications
                </h1>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bell /> Platform Notifications</CardTitle>
                        <CardDescription>Important alerts and updates for platform administrators.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-48 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                            <p className="text-muted-foreground">No new notifications for admins.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
