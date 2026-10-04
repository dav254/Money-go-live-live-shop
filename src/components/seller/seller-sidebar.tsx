'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  ShoppingBag,
  Package,
  Store,
  Home,
  MessageSquare,
  Radio,
  Sparkles,
  AreaChart,
  Video,
  Layers,
  Heart,
  Smartphone,
  Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import React, { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Chat } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { InstallAppButton } from '@/components/install-app-button';
import { SectionNavItem } from '@/components/layout/section-nav-item';

export function SellerSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const isActive = (path: string) => !!pathname && (pathname === path || pathname.startsWith(path));

  // Query for active orders (pending or processing)
  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'orders'),
        where('sellerId', '==', user.uid),
        where('orderStatus', 'in', ['pending', 'processing'])
    );
  }, [firestore, user]);

  const { data: activeOrders } = useCollection<Order>(ordersQuery);
  const activeOrdersCount = activeOrders?.length || 0;

  // Query for chats to find total unread count
  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'chats'),
        where('participantIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: chats } = useCollection<Chat>(chatsQuery);

  const unreadMessagesCount = useMemo(() => {
    if (!chats || !user) return 0;
    return chats.reduce((acc, chat) => acc + (chat.unreadCounts?.[user.uid] || 0), 0);
  }, [chats, user]);

  // Request marketplace: offers this seller has on file (badge counts the
  // live ones client-side — single-field index only, no composite needed).
  const myOffersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'offers'), where('sellerId', '==', user.uid));
  }, [firestore, user]);
  const { data: myOffers } = useCollection<{ status?: string }>(myOffersQuery);
  const liveOffersCount = useMemo(
    () => (myOffers ?? []).filter((o) => o.status === 'submitted').length,
    [myOffers],
  );

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Store Management</SidebarGroupLabel>
        <SidebarMenu>
          <SectionNavItem href="/dashboard/seller">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              isActive={pathname === '/dashboard/seller'}
            >
              <Link href="/dashboard/seller">
                <Home />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>
          
          <SectionNavItem href="/dashboard/products">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/products')}>
              <Link href="/dashboard/products">
                <ShoppingBag />
                <span>Inventory</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/dashboard/seller/orders">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/orders')}>
              <Link href="/dashboard/seller/orders" className="relative flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Package />
                  <span>Orders</span>
                </div>
                {activeOrdersCount > 0 && (
                    <Badge className="h-5 min-w-[1.25rem] px-1 bg-red-600 text-white border-none text-[10px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-red-600/20">
                        {activeOrdersCount}
                    </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/dashboard/seller/analytics">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/analytics')}>
              <Link href="/dashboard/seller/analytics">
                <AreaChart />
                <span>Analytics</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/messages">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/messages')}>
              <Link href="/messages" className="relative flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <MessageSquare />
                  <span>Inbox</span>
                </div>
                {unreadMessagesCount > 0 && (
                    <Badge className="h-5 min-w-[1.25rem] px-1 bg-primary text-white border-none text-[10px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-primary/20">
                        {unreadMessagesCount}
                    </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Growth</SidebarGroupLabel>
        <SidebarMenu>
          <SectionNavItem href="/dashboard/seller/live">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={pathname === '/dashboard/seller/live'}>
              <Link href="/dashboard/seller/live" className="relative flex items-center justify-between w-full">
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

          <SectionNavItem href="/dashboard/seller/ai-studio">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/ai-studio') || isActive('/dashboard/seller/ai-tools')}>
              <Link href="/dashboard/seller/ai-studio">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#FF4D2E] to-[#0EA5E9] shadow-md shadow-primary/25">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="font-semibold">AI Studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/requests">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/requests')}>
              <Link href="/requests" className="relative flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-cyan-500" />
                  <span>Requests</span>
                </div>
                {liveOffersCount > 0 && (
                  <Badge className="h-5 min-w-[1.25rem] px-1 bg-cyan-500 text-white border-none text-[10px] font-black shrink-0 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    {liveOffersCount}
                  </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Videos</SidebarGroupLabel>
        <SidebarMenu>
          <SectionNavItem href="/dashboard/seller/live-feed">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              asChild
              isActive={isActive('/dashboard/seller/live-feed') && !searchParams?.get('view')}
            >
              <Link href="/dashboard/seller/live-feed">
                <Video className="text-blue-500" />
                <span>Discovery Feed</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              asChild
              isActive={isActive('/dashboard/seller/live-feed') && searchParams?.get('view') === 'saved'}
            >
              <Link href="/dashboard/seller/live-feed?view=saved">
                <Heart className="text-pink-500" />
                <span>My Saved Items</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>
        </SidebarMenu>
      </SidebarGroup>
      
      <SidebarMenu className="mt-auto">
        <Separator className="my-2" />
        <SidebarMenuItem className="px-2 pb-1">
            <InstallAppButton className="w-full justify-center border-primary/30 text-xs font-bold uppercase tracking-widest" />
        </SidebarMenuItem>
        <SectionNavItem href="/sellers">
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                size="sm"
                variant="outline"
                isActive={isActive(`/sellers/${user?.uid}`)}
            >
                <Link href={`/sellers/${user?.uid}`}>
                    <Store />
                    <span>View My Shop</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/dashboard/account">
        <SidebarMenuItem>
           <SidebarMenuButton asChild size="sm" isActive={isActive('/dashboard/account')}>
            <Link href="/dashboard/account">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userProfile?.profilePictureUrl} />
                <AvatarFallback>{userProfile?.fullName?.[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate">{userProfile?.fullName || "My Account"}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
      </SidebarMenu>
    </>
  );
}