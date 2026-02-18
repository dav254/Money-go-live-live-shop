
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from '@/components/ui/sidebar';
import {
  Wallet,
  MessageSquare,
  Home,
  Package,
  Info,
  HelpCircle,
  ShoppingCart,
  RadioTower,
  CreditCard,
  Radio,
  Video,
} from 'lucide-react';
import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Logo } from '../logo';

export function BuyerSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  
  return (
    <>
    <SidebarHeader className="border-b bg-card p-4">
      <Logo className="h-8 w-auto text-primary" />
    </SidebarHeader>
    
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
