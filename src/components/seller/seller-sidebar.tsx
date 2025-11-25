
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
  Video,
  Banknote,
  Store,
  HelpCircle,
  Users,
  Home,
  User,
  MessageSquare,
  Bookmark,
  RadioTower,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useUserProfile } from '@/firebase';

export function SellerSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Store Management</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller') && pathname === '/dashboard/seller'}
            >
              <Link href="/dashboard/seller">
                <Home />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/products')}>
              <Link href="/dashboard/products">
                <ShoppingBag />
                <span>Products</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/orders')}>
              <Link href="/dashboard/seller/orders">
                <Package />
                <span>Orders</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/messages')}>
              <Link href="/dashboard/seller/messages">
                <MessageSquare />
                <span>Messages</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Growth</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/live') || isActive('/dashboard/seller/studio')}>
              <Link href="/dashboard/seller/studio">
                <RadioTower />
                <span>Live Studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/earnings') || isActive('/dashboard/seller/wallet')}>
              <Link href="/dashboard/seller/earnings">
                <Banknote />
                <span>Sales & Payouts</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/reseller')}>
              <Link href="/dashboard/seller/reseller/performance">
                <Users />
                <span>Reseller Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      <SidebarMenu className="mt-auto">
         <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/help')}>
              <Link href="/dashboard/seller/help">
                <HelpCircle />
                <span>Support</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        <Separator className="my-2" />
        <SidebarMenuItem>
           <SidebarMenuButton asChild isActive={isActive('/dashboard/account')}>
            <Link href="/dashboard/account">
              <Avatar className="h-7 w-7">
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
