'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search, Menu, X, Radio, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserNav } from '@/components/layout/user-nav';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { BuyerSidebar } from './buyer-sidebar';
import { SidebarTrigger } from '../ui/sidebar';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useUserProfile, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Chat, LiveSession } from '@/lib/types';
import { Logo } from '../logo';
import { Badge } from '../ui/badge';

export function BuyerHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams?.get('q') || '');
  const { user, isLoading: isUserLoading } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  
  const isLoading = isUserLoading || isProfileLoading;
  
  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid));
  }, [user, firestore]);

  const { data: chats } = useCollection<Chat>(chatsQuery);

  const unreadCount = useMemo(() => {
    if (!chats || !user) return 0;
    return chats.reduce((acc, chat) => acc + (chat.unreadCounts?.[user.uid] || 0), 0);
  }, [chats, user]);

  // Query for any active live sessions globally
  const activeSessionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore]);

  const { data: activeSessions } = useCollection<LiveSession>(activeSessionsQuery);
  const liveCount = useMemo(() => activeSessions?.length || 0, [activeSessions]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const newQuery = searchQuery.trim();
      const currentQuery = searchParams?.get('q');
      
      if (newQuery && newQuery !== currentQuery) {
        router.push(`/search?q=${encodeURIComponent(newQuery)}`, { scroll: false });
      } else if (!newQuery && currentQuery) {
        router.push('/search', { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, router, searchParams]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
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
                    <Link href="/buyer/dashboard">
                      <Logo className="text-3xl text-primary cursor-pointer" />
                    </Link>
                 </SheetTitle>
              </SheetHeader>
              <div className="p-4 pt-0">
                <BuyerSidebar />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        
        <SidebarTrigger className="hidden md:flex" />

        <div className="hidden lg:block min-w-0">
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <Link href="/buyer/dashboard">
                 <h1 className="text-sm font-black uppercase tracking-tight truncate hover:text-primary transition-colors">
                    Shop GoEarn<span className="text-[10px] lowercase align-top opacity-80">vid</span>
                </h1>
              </Link>
            )}
        </div>
      </div>

      <div className={cn(
          "absolute left-1/2 top-1/2 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4 transition-opacity md:static md:w-full md:max-w-lg md:translate-x-0 md:translate-y-0 md:px-0 md:opacity-100",
          isSearchOpen ? "opacity-100 z-50" : "pointer-events-none opacity-0 md:pointer-events-auto"
      )}>
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search products, sellers..." 
              className="pl-9 bg-muted/30 border-white/5 rounded-xl"
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
      
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSearchOpen(true)}>
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
        </Button>
        <Button variant="ghost" size="icon" asChild title="Messages" className="relative">
          <Link href="/messages">
            <MessageSquare className="h-5 w-5" />
            {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
            )}
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex relative" asChild title="Live Now">
          <Link href="/buyer/live-now">
            <Radio className={cn("h-5 w-5", liveCount > 0 ? "text-red-600" : "")} />
            {liveCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 bg-red-600 text-white border-none text-[8px] font-black flex items-center justify-center shadow-lg shadow-red-600/20">
                {liveCount}
              </Badge>
            )}
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
