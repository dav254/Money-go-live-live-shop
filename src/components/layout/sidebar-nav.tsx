
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
  ChevronDown,
  Home,
  LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function BuyerSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Menu</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/buyer/dashboard')}>
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

        <Collapsible open={isOrdersOpen} onOpenChange={setIsOrdersOpen} asChild>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="w-full"
                isActive={isActive('/buyer/my-orders')}
              >
                <Package />
                <span>My Orders</span>
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 transition-transform',
                    isOrdersOpen && 'rotate-180'
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="pl-6">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/buyer/my-orders')}
                  >
                    <Link href="/buyer/my-orders">
                      <span>Current Orders</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/buyer/my-orders/delivered')}
                  >
                    <Link href="/buyer/my-orders">
                      <span>Delivered</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        <Collapsible
          open={isWishlistOpen}
          onOpenChange={setIsWishlistOpen}
          asChild
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="w-full"
                isActive={isActive('/buyer/wishlist')}
              >
                <Heart />
                <span>Wishlist</span>
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 transition-transform',
                    isWishlistOpen && 'rotate-180'
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="pl-6">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/buyer/wishlist')}
                  >
                    <Link href="/buyer/wishlist">
                      <span>My Wishlist</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/buyer/wishlist/shops')}
                  >
                    <Link href="/buyer/wishlist">
                      <span>Saved Shops</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        <Collapsible open={isWalletOpen} onOpenChange={setIsWalletOpen} asChild>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="w-full"
                isActive={isActive('/buyer/wallet')}
              >
                <Wallet />
                <span>Wallet</span>
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 transition-transform',
                    isWalletOpen && 'rotate-180'
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="pl-6">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/buyer/wallet')}
                  >
                    <Link href="/buyer/wallet">
                      <span>Balance</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive('/buyer/wallet/transactions')}
                  >
                    <Link href="/buyer/wallet">
                      <span>History</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function SellerSidebarNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const isActive = (path: string) => pathname.startsWith(path);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);

  // This is a placeholder logic. Replace with your actual user role detection.
  // For demonstration, we assume a user might have a role property.
  // In a real app, this would come from your user object from Firestore or JWT claims.
  const userRole = (user as any)?.profile?.userRole || 'buyer';

  // Only render this for sellers
  if (userRole !== 'seller') {
    return null;
  }

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
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/wishlist')}>
            <Link href="/dashboard/seller/wishlist">
              <Heart />
              <span>Wishlist</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <Collapsible open={isFinanceOpen} onOpenChange={setIsFinanceOpen}>
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="w-full"
                isActive={
                  isActive('/dashboard/seller/earnings') ||
                  isActive('/dashboard/seller/wallet')
                }
              >
                <Banknote />
                <span>Finances & Payments</span>
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 transition-transform',
                    isFinanceOpen && 'rotate-180'
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="pl-6">
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
              </SidebarMenu>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

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
  const { user } = useUser();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>My Reseller Hub</SidebarGroupLabel>
      <SidebarMenu></SidebarMenu>
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
