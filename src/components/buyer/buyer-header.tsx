'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bell, MessageSquare, Video, Search, Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Input } from '@/components/ui/input';
import { UserNav } from '@/components/layout/user-nav';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { BuyerSidebar } from './buyer-sidebar';
import { SidebarTrigger } from '../ui/sidebar';
import { Skeleton } from '../ui/skeleton';
import { ThemeToggle } from '../theme-toggle';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useUserProfile } from '@/firebase';

export function BuyerHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);

  const isLoading = isUserLoading || isProfileLoading;
  const buyerName = userProfile?.fullName || 'Valued Buyer';
  
  // Update search query in URL as user types
  useEffect(() => {
    const timer = setTimeout(() => {
      const newQuery = searchQuery.trim();
      const currentQuery = searchParams.get('q');
      
      if (newQuery && newQuery !== currentQuery) {
        router.push(`/search?q=${encodeURIComponent(newQuery)}`, { scroll: false });
      } else if (!newQuery && currentQuery) {
        router.push('/search', { scroll: false });
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, router, searchParams]);

  // Sync state with URL on navigation
  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false); // Close mobile search on submit
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
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
                  <Logo className="h-8 w-auto text-primary" />
                </SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <BuyerSidebar />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Desktop Sidebar Trigger */}
        <SidebarTrigger className="hidden md:flex" />

        <div className="hidden md:block">
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <h1 className="text-lg font-semibold">
                Welcome, <span className="text-primary">{buyerName}</span>
              </h1>
            )}
        </div>
      </div>

      {/* Search Bar - Conditional Rendering */}
      <div className={cn(
          "absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4 transition-opacity md:static md:w-full md:max-w-lg md:translate-x-0 md:translate-y-0 md:px-0 md:opacity-100",
          isSearchOpen ? "opacity-100 z-50" : "pointer-events-none opacity-0 md:pointer-events-auto"
      )}>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search products, sellers..." 
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearchOpen && (
              <Button variant="ghost" size="icon" type="button" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 md:hidden" onClick={() => setIsSearchOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSearchOpen(true)}>
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="hidden md:inline-flex relative" asChild>
          <Link href="/buyer/notifications">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
          <Link href="/messages">
            <MessageSquare className="h-5 w-5" />
            <span className="sr-only">Chat</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
          <Link href="/live">
            <Video className="h-5 w-5" />
            <span className="sr-only">Live Feed</span>
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
