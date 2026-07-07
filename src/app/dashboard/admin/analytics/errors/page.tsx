'use client';

import { AdminLayout } from '@/components/layout/admin-layout';

export default function RemovedPage() {
  return (
    <AdminLayout>
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold uppercase tracking-tighter">Section Removed</h1>
        <p className="text-muted-foreground mt-2 font-medium">System error logs are no longer available in this version.</p>
      </div>
    </AdminLayout>
  );
}
