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
import type { Chat, LiveSession, Order } from '@/lib/types';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';

export function BuyerSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  
  const { user } = useUser();
  const firestore = useFirestore();

  // Query for unread messages
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
  const isAnySellerLive = useMemo(() => activeSessions && activeSessions.length > 0, [activeSessions]);

  // Query for cart items to display count
  const cartQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [user, firestore]);

  const { data: cartItems } = useCollection(cartQuery);
  const cartCount = cartItems?.length || 0;

  // Query for active orders (pending, processing, shipped, delivery)
  const activeOrdersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('buyerId', '==', user.uid),
      where('orderStatus', 'in', ['pending', 'processing', 'shipped', 'delivery'])
    );
  }, [user, firestore]);

  const { data: activeOrders } = useCollection<Order>(activeOrdersQuery);
  const activeOrdersCount = activeOrders?.length || 0;

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
            <Link href="/buyer/live-now" className="relative">
              <Radio className={isAnySellerLive ? "text-red-600" : ""} />
              <span>Live Now</span>
              {isAnySellerLive && (
                <span className="absolute right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                </span>
              )}
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
            <Link href="/cart" className="relative">
              <ShoppingCart />
              <span>My Cart</span>
              {cartCount > 0 && (
                <Badge className="absolute right-2 h-4 min-w-[1.25rem] px-1 bg-primary text-white border-none text-[9px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-primary/20">
                  {cartCount}
                </Badge>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/messages')} tooltip="Messages">
            <Link href="/messages" className="relative">
              <MessageSquare />
              <span>Messages</span>
              {unreadCount > 0 && (
                <Badge className="absolute right-2 h-4 min-w-[1.25rem] px-1 bg-primary text-white border-none text-[9px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-primary/20">
                  {unreadCount}
                </Badge>
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
                <Link href="/buyer/my-orders" className="relative">
                  <Package />
                  <span>My Orders</span>
                  {activeOrdersCount > 0 && (
                    <Badge className="absolute right-2 h-4 min-w-[1.25rem] px-1 bg-blue-600 text-white border-none text-[9px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-blue-600/20">
                      {activeOrdersCount}
                    </Badge>
                  )}
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
