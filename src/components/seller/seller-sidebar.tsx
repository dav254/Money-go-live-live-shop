
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Heart,
  Wallet,
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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';

export function SellerSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center">
          <span className="grow">Seller Dashboard</span>
          <SidebarTrigger />
        </SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller') && pathname === '/dashboard/seller'}
              tooltip="Home"
            >
              <Link href="/dashboard/seller">
                <Home />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/products')} tooltip="Products">
              <Link href="/dashboard/products">
                <ShoppingBag />
                <span>Products</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/orders')}
               tooltip="Orders"
            >
              <Link href="/dashboard/seller/orders">
                <Package />
                <span>Orders</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/messages')}
               tooltip="Messages"
            >
              <Link href="/dashboard/seller/messages">
                <MessageSquare />
                <span>Messages</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/live/start')}
               tooltip="Live Selling"
            >
              <Link href="/dashboard/live/start">
                <Video />
                <span>Live Selling</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/earnings')}
               tooltip="Sales & Payouts"
            >
              <Link href="/dashboard/seller/earnings">
                <Banknote />
                <span>Sales & Payouts</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/wallet')}
               tooltip="Wallet"
            >
              <Link href="/dashboard/seller/wallet">
                <Wallet />
                <span>Wallet</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/wishlist')}  tooltip="My Wishlist">
              <Link href="/dashboard/seller/wishlist">
                <Bookmark />
                <span>My Wishlist</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/reseller')}
               tooltip="Reseller Center"
            >
              <Link href="/dashboard/seller/reseller/performance">
                <Users />
                <span>Reseller Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(`/sellers/${user?.uid}`)}
               tooltip="View My Shop"
            >
              <Link href={user ? `/sellers/${user.uid}` : '/login'}>
                <Store />
                <span>View My Shop</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/settings')}
               tooltip="Shop Settings"
            >
              <Link href="/dashboard/seller/settings">
                <Settings />
                <span>Shop Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive('/dashboard/seller/help')}
               tooltip="Support & Help"
            >
              <Link href="/dashboard/seller/help">
                <HelpCircle />
                <span>Support & Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/account')}  tooltip="Account">
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
