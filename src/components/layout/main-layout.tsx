
'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu, User, Bell, MessageSquare, Video, Search } from 'lucide-react';
import { SellerSidebarNav, AccountSidebarNav, BuyerSidebarNav, ResellerSidebarNav, AdminSidebarNav } from './sidebar-nav';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { useUser } from '@/firebase/auth/use-user';
import { Input } from '../ui/input';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { Skeleton } from '../ui/skeleton';
import { UserNav } from './user-nav';

function SidebarNav({ role }: { role: string | undefined }) {
  // Explicitly check for admin first to ensure it takes precedence.
  if (role === 'admin') {
    return <AdminSidebarNav />;
  }
  if (role === 'seller') {
    return <SellerSidebarNav />;
  }
  if (role === 'reseller') {
    return <ResellerSidebarNav />;
  }
  // Default to buyer for any other role or if the role is undefined.
  return <BuyerSidebarNav />;
}


export function MainLayout({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const userRole = userProfile?.userRole;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-72 flex-col bg-card p-4">
                  <Link href="/" className="mb-6">
                    <Logo className="h-8 w-auto text-primary" />
                  </Link>
                  <nav className="flex flex-1 flex-col gap-4">
                    {isProfileLoading ? (
                      <p>Loading...</p>
                    ) : (
                      <SidebarNav role={userRole} />
                    )}
                  </nav>
                  <div className="mt-auto">
                    <AccountSidebarNav />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <Link href="/" className="hidden md:block">
              <Logo className="h-8 w-auto text-primary" />
            </Link>
          </div>

          <div className="hidden md:flex flex-1 max-w-lg items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search products, orders..." className="pl-9" />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden md:inline-flex">
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
            </Button>
             <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
                <Link href="/messages">
                    <MessageSquare className="h-5 w-5" />
                    <span className="sr-only">Chat</span>
                </Link>
            </Button>
             <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
                <Link href="/dashboard/live/start">
                    <Video className="h-5 w-5" />
                    <span className="sr-only">Live</span>
                </Link>
            </Button>
            <UserNav />
          </div>
        </header>
        <div className="flex flex-1">
          <aside className="hidden w-64 flex-col border-r bg-card md:flex">
            <div className="flex flex-1 flex-col gap-y-4 overflow-y-auto p-4">
              {isProfileLoading ? (
                <p className="p-4">Loading navigation...</p>
              ) : (
                <SidebarNav role={userRole} />
              )}
            </div>
            <div className="p-4">
              <AccountSidebarNav />
            </div>
          </aside>
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
