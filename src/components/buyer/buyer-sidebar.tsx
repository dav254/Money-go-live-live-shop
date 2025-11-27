
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  Wallet,
  MessageSquare,
  Home,
  Package,
  User,
  Video,
  Info,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BuyerSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  
  return (
    <>
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={pathname === '/buyer/dashboard'}>
            <Link href="/buyer/dashboard">
              <Home />
              <span>Home</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/live')}>
            <Link href="/live">
              <Video />
              <span>Live Selling</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/messages')}>
            <Link href="/messages">
              <MessageSquare />
              <span>Messages</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/buyer/my-orders')}>
            <Link href="/buyer/my-orders">
              <Package />
              <span>My Orders</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/buyer/wallet')}>
            <Link href="/buyer/wallet">
              <Wallet />
              <span>Wallet</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
     <SidebarGroup>
        <SidebarGroupLabel>Resources</SidebarGroupLabel>
        <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/buyer/about')}>
                <Link href="/buyer/about">
                  <Info />
                  <span>About Go Earn</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/buyer/help')}>
                <Link href="/buyer/help">
                  <HelpCircle />
                  <span>Help Center</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/account')}>
            <Link href="/dashboard/account">
              <User />
              <span>Account</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
