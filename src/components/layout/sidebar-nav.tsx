
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  Heart,
  Wallet,
  User,
  Settings,
  ShoppingBag,
  AreaChart,
  Package,
  Video,
  Banknote,
  Store,
  HelpCircle,
  Users,
  MessageSquare,
  Home,
  FolderKanban,
  BookOpen,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';


export function BuyerSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  
  return (
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
          <SidebarMenuButton asChild isActive={isActive('/buyer/wishlist')}>
            <Link href="/buyer/wishlist">
              <Heart />
              <span>Wishlist</span>
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
  );
}

export function SellerSidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const isActive = (path: string) => pathname.startsWith(path);
  
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Seller Dashboard</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/seller') && pathname === '/dashboard/seller'}
          >
            <Link href="/dashboard/seller">
              <AreaChart />
              <span>Dashboard</span>
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
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/seller/orders')}
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
            isActive={isActive('/dashboard/live/start')}
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
          >
            <Link href="/dashboard/seller/wallet">
              <Wallet />
              <span>Wallet</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/wishlist')}>
                <Link href="/dashboard/seller/wishlist">
                <Heart />
                <span>Favorites</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isActive('/dashboard/seller/reseller')}
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
          >
            <Link href="/dashboard/seller/help">
              <HelpCircle />
              <span>Support & Help</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function ResellerSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Reseller Hub</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller') && !isActive('/dashboard/reseller/products') && !isActive('/dashboard/reseller/toolkit') && !isActive('/dashboard/reseller/commissions') && !isActive('/dashboard/reseller/wallet')}>
            <Link href="/dashboard/reseller">
              <AreaChart />
              <span>Dashboard</span>
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
              <span>Reseller Toolkit</span>
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
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/academy')}>
            <Link href="/dashboard/seller/help">
              <BookOpen />
              <span>MoneyGo Academy</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/reseller/help')}>
            <Link href="/dashboard/seller/help">
              <HelpCircle />
              <span>Support</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AdminSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/admin')}>
            <Link href="/dashboard/admin">
              <Shield />
              <span>Dashboard</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function AccountSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
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
  );
}
