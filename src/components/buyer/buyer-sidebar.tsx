
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
  ShoppingCart,
  RadioTower,
  CreditCard,
  Bell,
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
          <SidebarMenuButton asChild size="sm" isActive={pathname === '/buyer/dashboard'} tooltip="Home">
            <Link href="/buyer/dashboard">
              <Home />
              <span>Home</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/live-stream')} tooltip="Live Feed">
            <Link href="/buyer/live-stream">
              <RadioTower />
              <span>Live Feed</span>
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
            <Link href="/messages">
              <MessageSquare />
              <span>Messages</span>
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
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" isActive={isActive('/dashboard/account')} tooltip="Account Settings">
                <Link href="/dashboard/account">
                  <User />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

    <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/about')}>
            <Link href="/buyer/about">
              <Info />
              <span>About Us</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" isActive={isActive('/buyer/help')}>
            <Link href="/dashboard/reseller/support/help-center">
                <HelpCircle />
                <span>Help Center</span>
            </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
    </>
  );
}
