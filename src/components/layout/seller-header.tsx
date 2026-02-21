
'use client';

import { useState } from 'react';
import { useUser, useAuth } from '@/firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { MobileSidebar, SidebarToggle } from '@/components/layout/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { UserNav } from '@/components/layout/user-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { useScroll } from '@/hooks/use-scroll';
import { SellerSidebar } from './seller-sidebar';

export function SellerHeader() {
    const { user, isLoading } = useUser();
    const pathname = usePathname();
    const router = useRouter();
    const scrolled = useScroll();

    return (
        <header className={cn(
            "sticky top-0 z-40 w-full border-b bg-card transition-all duration-300",
            scrolled ? "backdrop-blur-xl" : "",
        )}>
            <div className="container flex h-16 items-center">
                <div className="hidden md:flex">
                    <SidebarToggle />
                    <h1 className="font-bold text-lg ml-4 whitespace-nowrap">Seller Dashboard</h1>
                </div>
                
                <MobileSidebar>
                    <SellerSidebar />
                </MobileSidebar>

                <div className="flex flex-1 items-center justify-end space-x-4">
                    <nav className="flex items-center space-x-2">
                        {!isLoading && user && <UserNav user={user} />}
                    </nav>
                </div>
            </div>
        </header>
    );
}
