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
  Coins,
  QrCode,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
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
        <SidebarGroupLabel className="text-[11px] font-semibold tracking-widest uppercase text-white/40">Store Management</SidebarGroupLabel>
        <SidebarMenu>
          <SectionNavItem href="/dashboard/seller">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              isActive={pathname === '/dashboard/seller'}
              className="text-white"
            >
              <Link href="/dashboard/seller" className="text-white">
                <Home className="text-white" />
                <span className="text-white">Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>
          
          <SectionNavItem href="/dashboard/products">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/products')} className="text-white">
              <Link href="/dashboard/products" className="text-white">
                <ShoppingBag className="text-white" />
                <span className="text-white">Inventory</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/dashboard/seller/orders">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/orders')} className="text-white">
              <Link href="/dashboard/seller/orders" className="relative flex items-center justify-between w-full text-white">
                <div className="flex items-center gap-2">
                  <Package className="text-white" />
                  <span className="text-white">Orders</span>
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
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/analytics')} className="text-white">
              <Link href="/dashboard/seller/analytics" className="text-white">
                <AreaChart className="text-white" />
                <span className="text-white">Analytics</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/messages">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/messages')} className="text-white">
              <Link href="/messages" className="relative flex items-center justify-between w-full text-white">
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-white" />
                  <span className="text-white">Inbox</span>
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
            <SidebarMenuButton size="sm" asChild isActive={pathname === '/dashboard/seller/live'} className="text-white">
              <Link href="/dashboard/seller/live" className="relative flex items-center justify-between w-full text-white">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-red-600 to-orange-500 shadow-md shadow-red-600/25">
                    <Radio className="h-3.5 w-3.5 text-white" />
                  </span>
                  <span className="font-semibold text-white">LIVE</span>
                </div>
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/dashboard/seller/ai-studio">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/ai-studio') || isActive('/dashboard/seller/ai-tools')} className="text-white">
              <Link href="/dashboard/seller/ai-studio" className="text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#FF4D2E] to-[#0EA5E9] shadow-md shadow-primary/25">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="font-semibold text-white">AI Studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/dashboard/seller/points">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/points')} className="text-white">
              <Link href="/dashboard/seller/points" className="text-white">
                <Coins className="text-white" />
                <span className="text-white">AI Points</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>

          <SectionNavItem href="/requests">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/requests')} className="text-white">
              <Link href="/requests" className="relative flex items-center justify-between w-full text-white">
                <div className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-white" />
                  <span className="text-white">Requests</span>
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
              className="text-white"
            >
              <Link href="/dashboard/seller/live-feed" className="text-white">
                <Video className="text-white" />
                <span className="text-white">Discovery Feed</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              asChild
              isActive={isActive('/dashboard/seller/live-feed') && searchParams?.get('view') === 'saved'}
              className="text-white"
            >
              <Link href="/dashboard/seller/live-feed?view=saved" className="text-white">
                <Heart className="text-white" />
                <span className="text-white">My Saved Items</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SectionNavItem>
        </SidebarMenu>
      </SidebarGroup>
      
      <SidebarMenu className="mt-auto">
        <Separator className="my-2" />
        <SidebarMenuItem className="px-2 pb-1">
            <InstallAppButton className="w-full justify-center border-white/30 text-xs font-bold uppercase tracking-widest text-white" />
        </SidebarMenuItem>
        <SectionNavItem href="/sellers">
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                size="sm"
                variant="outline"
                isActive={isActive(`/sellers/${user?.uid}`)}
                className="text-white"
            >
                <Link href={`/sellers/${user?.uid}`} className="text-white">
                    <Store className="text-white" />
                    <span className="text-white">View My Shop</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/dashboard/seller/share">
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                size="sm"
                variant="outline"
                isActive={isActive('/dashboard/seller/share')}
                className="text-white"
            >
                <Link href="/dashboard/seller/share" className="text-white">
                    <QrCode className="text-white" />
                    <span className="text-white">Share &amp; QR</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/dashboard/seller/wallet">
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                size="sm"
                isActive={isActive('/dashboard/seller/wallet')}
                className="text-white"
            >
                <Link href="/dashboard/seller/wallet" className="text-white">
                    <Wallet className="text-white" />
                    <span className="text-white">Payments</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
        <SectionNavItem href="/dashboard/account">
        <SidebarMenuItem>
           <SidebarMenuButton asChild size="sm" isActive={isActive('/dashboard/account')} className="text-white">
            <Link href="/dashboard/account" className="text-white">
              <Avatar className="h-6 w-6">
                <AvatarImage src={userProfile?.profilePictureUrl} />
                <AvatarFallback className="text-white">{userProfile?.fullName?.[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate text-white">{userProfile?.fullName || "My Account"}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        </SectionNavItem>
      </SidebarMenu>
    </>
  );
}