
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  AreaChart,
  ShoppingBag,
  FolderKanban,
  Banknote,
  Wallet,
  BookOpen,
  HelpCircle,
  User,
  Search,
  Bell,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ResellerSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  
  return (
    <>
    <SidebarGroup>
      <SidebarGroupLabel>Reseller Hub</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller') && pathname === '/dashboard/reseller'}>
            <Link href="/dashboard/reseller">
              <AreaChart />
              <span>Dashboard</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/notifications')}>
            <Link href="/dashboard/reseller/notifications">
              <Bell />
              <span>Notifications</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/products')}>
            <Link href="/dashboard/reseller/products">
              <ShoppingBag />
              <span>Products to Resell</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/toolkit')}>
            <Link href="/dashboard/reseller/toolkit">
              <FolderKanban />
              <span>AI Toolkit</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/commissions')}>
            <Link href="/dashboard/reseller/commissions">
              <Banknote />
              <span>Commissions</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/wallet')}>
            <Link href="/dashboard/reseller/wallet">
              <Wallet />
              <span>Wallet & Payouts</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/support')}>
            <Link href="/dashboard/reseller/support/help-center">
              <HelpCircle />
              <span>Support & Help</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
    <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
            <SidebarMenuButton asChild size="sm" isActive={isActive('/reseller/about')}>
                <Link href="/reseller/about">
                    <Info />
                    <span>About Go Earn</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
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
