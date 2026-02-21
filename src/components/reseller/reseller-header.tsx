'use client';

import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { UserNav } from '../layout/user-nav';
import { SidebarTrigger } from '../ui/sidebar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { ResellerSidebar } from './reseller-sidebar';
import { Logo } from '../logo';
import { ThemeToggle } from '../theme-toggle';
import type { UserProfile } from '@/lib/types';
import Link from 'next/link';

interface ResellerHeaderProps {
    userProfile: UserProfile | null;
    isLoading: boolean;
}

export function ResellerHeader({ userProfile, isLoading }: ResellerHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
         {/* Mobile Sidebar */}
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
                <div className="flex h-full flex-col gap-y-4 overflow-y-auto bg-card">
                    <SheetHeader className="sticky top-0 z-10 border-b bg-card p-4">
                         <SheetTitle asChild>
                            <Link href="/dashboard/reseller">
                              <Logo className="h-8 w-auto text-primary cursor-pointer" />
                            </Link>
                         </SheetTitle>
                    </SheetHeader>
                    <div className="p-4 pt-0">
                        <ResellerSidebar />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
        
        {/* Desktop Sidebar Trigger */}
        <SidebarTrigger className="hidden md:flex" />

        <div className="hidden md:block">
            <h1 className="text-lg font-black uppercase tracking-tighter">
              Reseller <span className="text-primary">Hub</span>
            </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}
