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
import type { Order } from '@/lib/types';

export function SellerSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const isActive = (path: string) => pathname === path || pathname.startsWith(path);

  // Query for active orders to show notification dot
  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'orders'),
        where('sellerId', '==', user.uid),
        where('orderStatus', 'in', ['pending', 'processing'])
    );
  }, [firestore, user]);

  const { data: activeOrders } = useCollection<Order>(ordersQuery);
  const hasActiveOrders = useMemo(() => activeOrders && activeOrders.length > 0, [activeOrders]);

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
              <Link href="/dashboard/seller/orders" className="relative">
                <Package />
                <span>Orders</span>
                {hasActiveOrders && (
                    <span className="absolute right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                    </span>
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
              <Link href="/messages">
                <MessageSquare />
                <span>Inbox</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Growth & Leads</SidebarGroupLabel>
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
                <span>AI Seller Toolkit</span>
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