
'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

export default function AdminViolationsPage() {
  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Support & Moderation: Reports & Violations
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>User & Product Reports</CardTitle>
            <CardDescription>
              Review user-submitted reports regarding policy violations, counterfeit products, or other issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
                <ShieldAlert className="h-12 w-12 text-muted-foreground" />
                <h3 className="font-semibold">Coming Soon</h3>
                <p className="text-muted-foreground">Violation tracking and resolution tools will be available here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
