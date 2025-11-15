
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';

export function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout sidebar={<BuyerSidebar />}>{children}</MainLayout>;
}
