
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { useUser } from '@/firebase';

export function ResellerLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useUser();
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading Reseller Dashboard...</p>
      </div>
    );
  }
  return <MainLayout sidebar={<ResellerSidebar />}>{children}</MainLayout>;
}
