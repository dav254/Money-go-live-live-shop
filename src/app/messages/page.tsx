'use client';

import { ChatSystem } from '@/components/messages/chat-system';
import { useUser, useUserProfile } from '@/firebase';
import { AdminLayout } from '@/components/layout/admin-layout';
import { SellerLayout } from '@/components/layout/seller-layout';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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

    // Resellers currently do not have a dedicated chat section
    if (userProfile?.userRole === 'reseller') {
        return (
            <MainLayout>
                <div className="flex h-screen w-full flex-col items-center justify-center text-center p-8 bg-black">
                    <Card className="max-w-md border-primary/20 bg-neutral-900">
                        <CardHeader>
                            <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                                <MessageSquare className="h-10 w-10 text-primary" />
                            </div>
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Inbox Coming Soon</CardTitle>
                            <CardDescription className="text-neutral-400 font-bold uppercase text-[10px] tracking-widest mt-2">
                                We are optimizing direct communication for our reseller network.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-neutral-500 mb-6"> Direct messaging between resellers and sellers is currently in development to ensure maximum security and efficiency.</p>
                            <Button asChild className="font-black uppercase tracking-widest text-xs h-12 w-full">
                                <Link href="/dashboard/reseller">
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </MainLayout>
        );
    }

    switch (userProfile?.userRole) {
        case 'admin':
            return <AdminLayout><ChatSystem /></AdminLayout>;
        case 'seller':
            return <SellerLayout><ChatSystem /></SellerLayout>;
        case 'buyer':
            return <BuyerLayout><ChatSystem /></BuyerLayout>;
        default:
             return <BuyerLayout><ChatSystem /></BuyerLayout>;
    }
}
