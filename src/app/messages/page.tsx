
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { ChatSystem } from '@/components/messages/chat-system';
import { useUser, useUserProfile } from '@/firebase';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { ResellerSidebar } from '@/components/reseller/reseller-sidebar';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';

function SidebarNav({ role }: { role: string | undefined }) {
  if (role === 'admin') return <AdminSidebar />;
  if (role === 'seller') return <SellerSidebar />;
  if (role === 'reseller') return <ResellerSidebar />;
  return <BuyerSidebar />;
}

export default function MessagesPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

    const isLoading = isUserLoading || isProfileLoading;

  return (
    <MainLayout sidebar={isLoading ? <p>Loading...</p> : <SidebarNav role={userProfile?.userRole} />}>
      <ChatSystem />
    </MainLayout>
  );
}
