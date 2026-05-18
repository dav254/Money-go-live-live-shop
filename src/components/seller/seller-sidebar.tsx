
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
  Store,
  HelpCircle,
  Home,
  MessageSquare,
  Radio,
  Video,
  Sparkles,
  AreaChart,
  TestTube,
  Users,
  Megaphone,
  History,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useUserProfile } from '@/firebase';
import React from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const NavCollapsible = ({
  title,
  icon: Icon,
  items,
  active,
}: {
  title: string;
  icon: React.ElementType;
  items: { href: string; label: string }[];
  active: boolean;
}) => {
  return (
    <Collapsible defaultOpen={active}>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
          active && 'bg-accent/50 text-accent-foreground'
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
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
  const isActive = (path: string) => pathname === path || pathname.startsWith(path);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Store Management</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              isActive={pathname === '/dashboard/seller'}
            >
              <Link href="/dashboard/seller">
                <Home />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/products')}>
              <Link href="/dashboard/products">
                <ShoppingBag />
                <span>Inventory</span>
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

          <NavCollapsible 
            title="Analytics"
            icon={AreaChart}
            active={isActive('/dashboard/seller/analytics')}
            items={[
                { href: '/dashboard/seller/analytics', label: 'Store Stats' },
                { href: '/dashboard/seller/analytics/live', label: 'Live History' },
            ]}
          />

          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/messages')}>
              <Link href="/messages">
                <MessageSquare />
                <span>Inbox</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Growth & Leads</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/go-live')}>
              <Link href="/dashboard/seller/go-live">
                <Radio className="text-red-600" />
                <span>Live Studio</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <NavCollapsible 
            title="Reseller Center"
            icon={Users}
            active={isActive('/dashboard/seller/reseller')}
            items={[
                { href: '/dashboard/seller/reseller', label: 'Commission Rules' },
                { href: '/dashboard/seller/reseller/performance', label: 'Top Performers' },
            ]}
          />

          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/marketing')}>
              <Link href="/dashboard/seller/marketing">
                <Megaphone />
                <span>Marketing Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/ai-tools')}>
              <Link href="/dashboard/seller/ai-tools">
                <Sparkles className="text-primary" />
                <span>AI Seller Toolkit</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      
      <SidebarGroup>
        <SidebarGroupLabel>Experimental</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="sm" asChild isActive={isActive('/dashboard/seller/media-pipe')}>
              <Link href="/dashboard/seller/media-pipe">
                <TestTube className="text-yellow-500" />
                <span>Media Transfer Test</span>
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
                <span>Store Settings</span>
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
                    <span>View Public Shop</span>
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
