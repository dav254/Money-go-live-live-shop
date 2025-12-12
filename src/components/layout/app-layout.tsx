
'use client';

import { useUser } from '@/firebase/auth/use-user';
import { MainLayout } from '@/components/layout/main-layout';
import { LandingLayout } from '@/components/layout/landing-layout';

export function AppLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useUser();
    
    if (isLoading) {
        return <div className="flex h-screen w-full items-center justify-center bg-dark-bg">Loading...</div>
    }

    return user ? <MainLayout>{children}</MainLayout> : <LandingLayout>{children}</LandingLayout>;
}
