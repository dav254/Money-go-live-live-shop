'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  MessageSquare,
  Home,
  Package,
  HelpCircle,
  ShoppingCart,
  CreditCard,
  Radio,
  Video,
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Chat } from '@/lib/types';
import { useMemo } from 'react';

export function BuyerSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  
  const { user } = useUser();
  const firestore = useFirestore();

  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'chats'), where('participantIds', 'array-contains', user.uid));
  }, [user, firestore]);

  const { data: chats } = useCollection<Chat>(chatsQuery);

  const unreadCount = useMemo(() => {
    if (!chats || !user) return 0;
    return chats.reduce((acc, chat) => acc + (chat.unreadCounts?.[user.uid] || 0), 0);
  }, [chats, user]);

  return (
    <>
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={pathname === '/buyer/dashboard'} tooltip="Home">
            <Link href="/buyer/dashboard">
              <Home />
              <span>Home</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/live')} tooltip="Live Feed">
            <Link href="/buyer/live">
              <Video />
              <span>Live Feed</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/live-now')} tooltip="Live Shows">
            <Link href="/buyer/live-now">
              <Radio className="text-red-600" />
              <span>Live Now</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/wishlist')} tooltip="Wishlist">
            <Link href="/buyer/wishlist">
              <Heart className="text-pink-500" />
              <span>Saved Items</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/cart')} tooltip="My Cart">
            <Link href="/cart">
              <ShoppingCart />
              <span>My Cart</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/messages')} tooltip="Messages">
            <Link href="/messages" className="relative">
              <MessageSquare />
              <span>Messages</span>
              {unreadCount > 0 && (
                <span className="absolute right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>

     <SidebarGroup>
        <SidebarGroupLabel>My Account</SidebarGroupLabel>
        <SidebarMenu>
             <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/my-orders')} tooltip="My Orders">
                <Link href="/buyer/my-orders">
                  <Package />
                  <span>My Orders</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/wallet')} tooltip="Payments">
                <Link href="/buyer/wallet">
                  <CreditCard />
                  <span>Payments</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

    <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/help')}>
            <Link href="/buyer/help">
                <HelpCircle />
                <span>Help Center</span>
            </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
