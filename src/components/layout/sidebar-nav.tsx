
'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import {
  Home,
  LayoutGrid,
  MessageSquare,
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
  Sparkles,
  Users,
  BookOpen,
  MailQuestion,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { ChevronRight } from 'lucide-react';
import { useUser } from '@/firebase';

export function BuyerSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="#">
            <Heart />
            <span>Wishlist</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="#">
            <Wallet />
            <span>Wallet</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarCollapsibleItem({ icon, label, children, defaultOpen = false, isActive = false }: { icon: React.ReactNode, label: string, children: React.ReactNode, defaultOpen?: boolean, isActive?: boolean }) {
    return (
        <Collapsible defaultOpen={defaultOpen || isActive}>
            <CollapsibleTrigger asChild>
                 <Button variant="ghost" className="w-full justify-start gap-2 px-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                    {icon}
                    <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden [&[data-state=open]]:rotate-90" />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <SidebarMenuSub>
                    {children}
                </SidebarMenuSub>
            </CollapsibleContent>
        </Collapsible>
    )
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
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller') && pathname === '/dashboard/seller'}>
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
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/orders')}>
              <Link href="/dashboard/seller/orders">
                  <Package />
                  <span>Orders</span>
              </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/live/start')}>
              <Link href="/dashboard/live/start">
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
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/reseller')}>
              <Link href="/dashboard/seller/reseller/performance">
                  <Users />
                  <span>Reseller Center</span>
              </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/earnings')}>
              <Link href="/dashboard/seller/earnings">
                  <Banknote />
                  <span>Sales & Payouts</span>
              </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive(`/sellers/${user?.uid}`)}>
            <Link href={user ? `/sellers/${user.uid}` : '/login'}>
              <Store />
              <span>View My Shop</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/settings')}>
            <Link href="/dashboard/seller/settings">
              <Settings />
              <span>Shop Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/seller/help')}>
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
      <SidebarMenu>
        
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
