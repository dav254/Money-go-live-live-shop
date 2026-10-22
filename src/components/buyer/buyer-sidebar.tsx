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
  ShoppingCart,
  CreditCard,
  Radio,
  Heart,
  Inbox,
  Compass,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Chat, Order } from '@/lib/types';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InstallAppButton } from '@/components/install-app-button';
import { SectionNavItem } from '@/components/layout/section-nav-item';

export function BuyerSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => !!pathname && pathname.startsWith(path);
  
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
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
        {/* ONE live surface only — VIDNOV LIVE (LiveKit transport). The old
            "Live Feed" / "Live Now" product feeds were removed. */}
        <SectionNavItem href="/live">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={!!pathname && (pathname === '/live' || pathname.startsWith('/live/'))} tooltip="Vidnov Live">
            <Link href="/live" className="relative flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-red-600 to-orange-500 shadow-md shadow-red-600/25">
                  <Radio className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="font-semibold">LIVE</span>
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        {/* Discovery — the vertical feed of sellers' media. It is its own route
            (`/buyer/discovery`) and NOT a link to `/dashboard/seller/live-feed`:
            that page wraps itself in `SellerLayout`, so following it would drop a
            buyer into the seller workspace with a back button pointing at a
            seller dashboard. Both surfaces render one shared feed component. */}
        <SectionNavItem href="/buyer/discovery">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/discovery')} tooltip="Discovery">
            <Link href="/buyer/discovery">
              <Compass className="text-violet-500" />
              <span>Discovery</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/buyer/requests">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/requests')} tooltip="Requests">
            <Link href="/buyer/requests">
              <Inbox className="text-cyan-500" />
              <span>Requests</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/buyer/wishlist">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/wishlist')} tooltip="Wishlist">
            <Link href="/buyer/wishlist">
              <Heart className="text-pink-500" />
              <span>My Saved Items</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        {/* "My Media" removed from the buyer sidebar for now — the media
            library is still reachable from the dashboard and /my-media. */}
         <SectionNavItem href="/cart">
         <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/cart')} tooltip="My Cart">
            <Link href="/cart" className="relative flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <ShoppingCart />
                <span>My Cart</span>
              </div>
              {cartCount > 0 && (
                <Badge className="h-5 min-w-[1.25rem] px-1 bg-primary text-white border-none text-[9px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-primary/20">
                  {cartCount}
                </Badge>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/messages">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/messages')} tooltip="Messages">
            <Link href="/messages" className="relative flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <MessageSquare />
                <span>Messages</span>
              </div>
              {unreadCount > 0 && (
                <Badge className="absolute right-2 h-4 min-w-[1rem] px-1 bg-red-600 text-white border-none text-[8px] font-black animate-bounce shrink-0 shadow-lg shadow-red-600/20">
                  {unreadCount}
                </Badge>
              )}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
      </SidebarMenu>
    </SidebarGroup>

     <SidebarGroup>
        <SidebarGroupLabel>My Account</SidebarGroupLabel>
        <SidebarMenu>
             <SectionNavItem href="/buyer/my-orders">
             <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/my-orders')} tooltip="My Orders">
                <Link href="/buyer/my-orders" className="relative flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Package />
                    <span>My Orders</span>
                  </div>
                  {activeOrdersCount > 0 && (
                    <Badge className="absolute right-2 h-4 min-w-[1.25rem] px-1 bg-blue-600 text-white border-none text-[10px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-blue-600/20">
                      {activeOrdersCount}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            </SectionNavItem>
            <SectionNavItem href="/buyer/wallet">
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/wallet')} tooltip="Payments">
                <Link href="/buyer/wallet">
                  <CreditCard />
                  <span>Payments</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            </SectionNavItem>
        </SidebarMenu>
      </SidebarGroup>

      {/* Install the updated app — same affordance sellers have. */}
      <SidebarMenu className="mt-auto">
        <Separator className="my-2" />
        <SidebarMenuItem className="px-2 pb-1">
          <InstallAppButton className="w-full justify-center border-primary/30 text-xs font-bold uppercase tracking-widest" />
        </SidebarMenuItem>
        <SectionNavItem href="/dashboard/account">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/dashboard/account')}>
            <Link href="/dashboard/account">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userProfile?.profilePictureUrl} />
                <AvatarFallback>{userProfile?.fullName?.[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate">{userProfile?.fullName || 'My Account'}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
      </SidebarMenu>
    </>
  );
}
