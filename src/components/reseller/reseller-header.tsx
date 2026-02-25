'use client';

import { UserNav } from '../layout/user-nav';
import { SidebarTrigger } from '../ui/sidebar';
import { ThemeToggle } from '../theme-toggle';
import type { UserProfile } from '@/lib/types';
import { Logo } from '../logo';
import Link from 'next/link';

interface ResellerHeaderProps {
    userProfile: UserProfile | null;
    isLoading: boolean;
}

export function ResellerHeader({ userProfile, isLoading }: ResellerHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <SidebarTrigger />

        <div className="hidden md:block">
            <Link href="/dashboard/reseller" className="flex items-center gap-2">
              <Logo className="h-8 w-auto text-primary cursor-pointer" />
              <h1 className="text-lg font-black uppercase tracking-tighter">
                Reseller <span className="text-primary">Hub</span>
              </h1>
            </Link>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  );
}
