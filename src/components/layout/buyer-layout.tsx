
'use client';

import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarProvider, 
  SidebarInset 
} from '@/components/ui/sidebar';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { BuyerSidebar } from '@/components/buyer/buyer-sidebar';
import { BuyerHeader } from '@/components/buyer/buyer-header';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

export function BuyerLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
  const { isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Loading Dashboard...</span>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon">
        <SidebarHeader className="border-b bg-card p-4">
          <Logo className="h-8 w-auto text-primary" />
        </SidebarHeader>
        <SidebarContent>
          <BuyerSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <BuyerHeader />
        <main className={cn("flex-1", !fullWidth && "p-4 sm:p-6 lg:p-8")}>
          <div className={cn("mx-auto h-full", !fullWidth && "max-w-7xl")}>
            <FirebaseErrorListener />
            {children}
          </div>
        </main>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  );
}
