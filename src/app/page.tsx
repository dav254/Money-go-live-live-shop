
'use client';

import { LivePreview } from '@/components/live/live-preview';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Bell, ChevronDown, ChevronUp, MessageSquare, Search, Video } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UserNav } from '@/components/layout/user-nav';
import { useCallback, useRef } from 'react';
import { feedItems } from '@/lib/placeholder-data';
import { VideoCard } from '@/components/feed/video-card';

export default function HomePage() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((direction: 'up' | 'down') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollAmount = container.clientHeight;
        const currentScroll = container.scrollTop;

        let targetScroll;
        if (direction === 'down') {
        targetScroll = currentScroll + scrollAmount;
        } else {
        targetScroll = currentScroll - scrollAmount;
        }
        
        container.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
        });

    }, []);


  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
       <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/" className="md:block">
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
            <Button variant="ghost" size="icon" className="hidden md:inline-flex relative" asChild>
                <Link href="/notifications">
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
                <Link href="/dashboard/live/start">
                    <Video className="h-5 w-5" />
                    <span className="sr-only">Live</span>
                </Link>
            </Button>
            <UserNav />
          </div>
        </header>
        <div className="relative h-[calc(100vh-4rem)]">
            <div 
            ref={scrollContainerRef}
            className="h-full w-full snap-y snap-mandatory overflow-y-scroll"
            >
            {feedItems.map((item, index) => (
                <div key={item.id} className="h-full w-full snap-start flex-shrink-0">
                <VideoCard item={item} />
                </div>
            ))}
            </div>
            
            {/* Scroll Buttons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-20 z-20">
                <Button 
                    size="icon" 
                    variant="ghost" 
                    className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
                    onClick={() => handleScroll('up')}
                    aria-label="Scroll Up"
                >
                    <ChevronUp className="h-6 w-6 text-white" />
                </Button>
                <Button 
                    size="icon" 
                    variant="ghost" 
                    className="rounded-full bg-black/50 h-12 w-12 hover:bg-black/70"
                    onClick={() => handleScroll('down')}
                    aria-label="Scroll Down"
                >
                    <ChevronDown className="h-6 w-6 text-white" />
                </Button>
            </div>
      </div>
    </div>
  );
}
