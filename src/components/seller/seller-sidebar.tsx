
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  Settings,
  ShoppingBag,
  Package,
  Store,
  HelpCircle,
  Users,
  Home,
  MessageSquare,
  Radio,
  Sparkles,
  AreaChart,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useUserProfile } from '@/firebase';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import React, { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Chat } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export function SellerSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path);

  // Query for active orders (pending or processing) to show in the sidebar badge
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

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Store Management</SidebarGroupLabel>
        <SidebarMenu>
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
          
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/products')}>
              <Link href="/dashboard/products">
                <ShoppingBag />
                <span>Inventory</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

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

          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/analytics')}>
              <Link href="/dashboard/seller/analytics">
                <AreaChart />
                <span>Analytics</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

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
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Growth</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/go-live')}>
              <Link href="/dashboard/seller/go-live">
                <Radio className="text-red-600" />
                <span>Live Studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/ai-tools')}>
              <Link href="/dashboard/seller/ai-tools">
                <Sparkles className="text-primary" />
                <span>AI Toolkit</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      <SidebarGroup>
        <SidebarGroupLabel>Help & Resources</SidebarGroupLabel>
         <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/about')}>
                <Link href="/dashboard/seller/about">
                  <Info />
                  <span>About Us</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
                <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/help')}>
                  <Link href="/dashboard/seller/help">
                    <HelpCircle />
                    <span>Support</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          </SidebarMenu>
      </SidebarGroup>


      <SidebarMenu className="mt-auto">
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/settings')}>
              <Link href="/dashboard/seller/settings">
                <Settings />
                <span>Shop Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        <Separator className="my-2" />
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                size="sm"
                variant="outline"
                isActive={isActive(`/sellers/${user?.uid}`)}
            >
                <Link href={`/sellers/${user?.uid}`}>
                    <Store />
                    <span>View Public Shop</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
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
      </SidebarMenu>
    </>
  );
}
