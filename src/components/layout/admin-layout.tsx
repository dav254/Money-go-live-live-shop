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

/**
 * Admin shell with a BLOCKING auth + role gate.
 *
 * This gate matters for Firestore security: every admin page and the admin
 * sidebar subscribe to admin-only collections (activityLogs, orders, …).
 * Those subscriptions must not fire until Firebase auth has resolved AND
 * the profile role is known — otherwise queries go out with auth:null and
 * the security rules correctly deny them (the "Missing or insufficient
 * permissions / auth null" errors).
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const router = useRouter();

  const authReady = !isUserLoading;
  const profileReady = !!user && !isProfileLoading;

  const isAdmin = userProfile?.userRole === 'admin' || userProfile?.role === 'admin';

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      router.replace('/admin-login-net');
      return;
    }
    if (!isProfileLoading && userProfile && !isAdmin) {
      router.replace('/admin-login-net');
    }
  }, [authReady, user, isProfileLoading, userProfile, isAdmin, router]);

  // Keep rendering the shell until auth + profile resolve; children (and the
  // sidebar's Firestore subscriptions) only mount once the role is verified.
  if (!authReady || !user || !profileReady || !isAdmin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {authReady && user && profileReady && !isAdmin ? 'Checking access…' : 'Verifying session…'}
        </p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="border-b bg-card p-4">
          <Link href="/dashboard/admin">
            <Logo className="text-3xl text-primary cursor-pointer" />
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
