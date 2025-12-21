
'use client';

import { SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Toaster } from '../ui/toaster';
import { Logo } from '../logo';
import { UserNav } from './user-nav';
import { FirebaseErrorListener } from '../FirebaseErrorListener';

export function MainLayout({ children, sidebar }: { children: React.ReactNode, sidebar?: React.ReactNode }) {
  
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <main className="flex-1">
          <FirebaseErrorListener />
          {children}
        </main>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
