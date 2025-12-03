
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
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-neutral-800 bg-black/80 px-4 backdrop-blur-sm md:px-6">
        <Link href="/" className="md:block">
          <Logo className="h-8 w-auto text-primary" />
        </Link>
        <div className="flex items-center gap-2">
            <Button variant="ghost" asChild><Link href="/live">Live Feed</Link></Button>
            <Button variant="ghost" asChild><Link href="/categories">Categories</Link></Button>
        </div>
        <div className="flex items-center gap-2">
          <UserNav />
        </div>
      </header>
      <main className="flex-1">
        <FirebaseErrorListener />
        {children}
      </main>
      <Toaster />
    </div>
  );
}
