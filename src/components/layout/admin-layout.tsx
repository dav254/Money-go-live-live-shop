
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout sidebar={<AdminSidebar />}>{children}</MainLayout>;
}
