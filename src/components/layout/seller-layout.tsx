
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { SellerSidebar } from '@/components/seller/seller-sidebar';

export function SellerLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout sidebar={<SellerSidebar />}>{children}</MainLayout>;
}
