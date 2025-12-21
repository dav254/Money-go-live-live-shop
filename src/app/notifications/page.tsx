
'use client';

import { MainLayout } from '@/components/layout/main-layout';

export default function DeprecatedNotificationsPage() {
  return (
    <MainLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Notifications
        </h1>
        <div className="flex h-64 flex-col items-center justify-center gap-4 text-center rounded-lg border border-dashed">
            <p className="text-muted-foreground">This page is no longer in use.</p>
        </div>
      </div>
    </MainLayout>
  );
}
