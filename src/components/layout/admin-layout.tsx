
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { useUser } from '@/firebase';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Admin Dashboard...</p>
      </div>
    );
  }
  
  return <MainLayout sidebar={<AdminSidebar />}>{children}</MainLayout>;
}
