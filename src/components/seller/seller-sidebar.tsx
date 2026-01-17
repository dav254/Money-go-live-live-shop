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
  Info,
  Wallet,
  Sparkles,
  AreaChart,
  FolderKanban,
  Megaphone,
  Bell,
  Tag,
  Calculator,
  Heart, // Added Heart icon here
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useUserProfile } from '@/firebase';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';


const NavCollapsible = ({
  title,
  icon: Icon,
  items,
  basePath,
}: {
  title: string;
  icon: React.ElementType;
  items: { href: string; label: string }[];
  basePath: string;
}) => {
  const pathname = usePathname();
  const isBaseActive = pathname.startsWith(`/dashboard/seller/${basePath}`);

  return (
    <Collapsible defaultOpen={isBaseActive}>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
          isBaseActive && 'bg-accent text-accent-foreground'
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>{title}</span>
        </div>
        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 py-1 pl-8">
          {items.map((item) => (
            <Link
              key={item.href}
              href={`/dashboard/seller/${basePath}/${item.href}`}
              className={cn(
                'rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                pathname === `/dashboard/seller/${basePath}/${item.href}` && 'bg-accent font-semibold text-accent-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};


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
              size="sm"
              isActive={isActive('/dashboard/seller') && pathname === '/dashboard/seller'}
            >
              <Link href="/dashboard/seller">
                <Home />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/notifications')}>
              <Link href="/dashboard/seller/notifications">
                <Bell />
                <span>Notifications</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/products')}>
              <Link href="/dashboard/products">
                <ShoppingBag />
                <span>Products</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/orders')}>
              <Link href="/dashboard/seller/orders">
                <Package />
                <span>Orders</span>
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
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/earnings')}>
              <Link href="/dashboard/seller/earnings">
                <Banknote />
                <span>Earnings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/wallet')}>
              <Link href="/dashboard/seller/wallet">
                <Wallet />
                <span>Wallet & Payouts</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Growth</SidebarGroupLabel>
        <SidebarMenu>
           <SidebarMenuItem>
            <NavCollapsible 
                title="Reseller Center"
                icon={Users}
                basePath="reseller"
                items={[
                    { href: 'rules', label: 'Commission Rules' },
                    { href: 'analytics', label: 'Analytics' },
                ]}
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/stream')}>
              <Link href="/dashboard/seller/stream">
                <RadioTower />
                <span>Live Studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/ai-tools')}>
              <Link href="/dashboard/seller/ai-tools">
                <Sparkles />
                <span>AI Tools</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/live')}>
              <Link href="/dashboard/seller/live">
                <Video />
                <span>Live Feed Preview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/ads')}>
              <Link href="/dashboard/seller/ads">
                <Megaphone />
                <span>TikTok Boost</span>
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
                    <span>View My Shop</span>
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
