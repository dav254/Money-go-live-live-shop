
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';

export function ResellerLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout sidebar={<ResellerSidebar />}>{children}</MainLayout>;
}
