
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { useUser } from '@/firebase';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { AdminHeader } from '../admin/admin-header';
import { Logo } from '../logo';
import { FirebaseErrorListener } from '../FirebaseErrorListener';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !isProfileLoading) {
      if (!user) {
        router.replace('/admin-login-net');
      } else if (userProfile && userProfile.userRole !== 'admin') {
        router.replace('/admin-login-net');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  // Blocking loading screen removed to open direct.

  return (
      <SidebarProvider>
          <Sidebar side="left" collapsible="icon">
              <SidebarHeader className="border-b bg-card p-4">
                  <Link href="/dashboard/admin">
                    <Logo className="h-8 w-auto text-primary cursor-pointer" />
                  </Link>
              </SidebarHeader>
              <SidebarContent>
                  <AdminSidebar />
              </SidebarContent>
          </Sidebar>
          <SidebarInset className="flex flex-col h-screen overflow-hidden">
              <AdminHeader />
              <main className="flex-1 overflow-y-auto">
                <FirebaseErrorListener />
                {children}
              </main>
          </SidebarInset>
      </SidebarProvider>
  );
}
