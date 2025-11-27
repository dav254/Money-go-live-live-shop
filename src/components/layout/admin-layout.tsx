
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { AdminHeader } from '../admin/admin-header';
import { Logo } from '../logo';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        // Not logged in, redirect to admin login page
        router.replace('/admin-login-net');
      } else if (userProfile && userProfile.userRole !== 'admin') {
        // Logged in, but not an admin, redirect to the admin login page as they are unauthorized
        router.replace('/admin-login-net');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const isLoading = isUserLoading || isProfileLoading;

  // While loading, show a loading screen to prevent content flash
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Verifying admin privileges...</p>
      </div>
    );
  }

  // If the user is confirmed to be an admin, render the layout.
  // Otherwise, render null because a redirect is in progress.
  if (user && userProfile && userProfile.userRole === 'admin') {
    return (
        <SidebarProvider>
            <Sidebar side="left" collapsible="icon">
                <SidebarHeader>
                    <Logo className="h-8 w-auto text-primary" />
                </SidebarHeader>
                <SidebarContent>
                    <AdminSidebar />
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                <AdminHeader />
                <main>
                  <FirebaseErrorListener />
                  {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
  }

  return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Redirecting to login...</p>
      </div>
  );
}
