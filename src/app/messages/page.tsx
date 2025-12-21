
'use client';

import { ChatSystem } from '@/components/messages/chat-system';
import { useUser, useUserProfile } from '@/firebase';
import { AdminLayout } from '@/components/layout/admin-layout';
import { SellerLayout } from '@/components/layout/seller-layout';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { MainLayout } from '@/components/layout/main-layout';

export default function MessagesPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

    const isLoading = isUserLoading || isProfileLoading;

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex h-screen w-full items-center justify-center">
                    <p>Loading Messages...</p>
                </div>
            </MainLayout>
        );
    }
    
    if (!user) {
         return (
            <MainLayout>
                <div className="flex h-screen w-full items-center justify-center">
                    <p>Please log in to view your messages.</p>
                </div>
            </MainLayout>
        );
    }

    switch (userProfile?.userRole) {
        case 'admin':
            return <AdminLayout><ChatSystem /></AdminLayout>;
        case 'seller':
            return <SellerLayout><ChatSystem /></SellerLayout>;
        case 'reseller':
             return (
                <ResellerLayout>
                    <ChatSystem />
                </ResellerLayout>
            );
        case 'buyer':
            return <BuyerLayout><ChatSystem /></BuyerLayout>;
        default:
             return <BuyerLayout><ChatSystem /></BuyerLayout>;
    }
}
