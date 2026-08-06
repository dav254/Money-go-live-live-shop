
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function AdminDisputesPlaceholderPage() {
    return (
        <AdminLayout>
            <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] p-8 text-center">
                <Card className="max-w-md border-white/5 bg-neutral-900/50">
                    <CardHeader>
                        <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                            <ShieldAlert className="h-10 w-10 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Section Removed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-neutral-500">
                            The dispute resolution interface has been decommissioned.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
}
