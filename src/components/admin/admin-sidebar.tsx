'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  LayoutGrid,
  Users2,
  PackageSearch,
  ScreenShare,
  CircleDollarSign,
  LifeBuoy,
  BrainCircuit,
  BarChart,
  User,
  Bell,
  ClipboardCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile, Product, LiveSession, SupportTicket, Order } from '@/lib/types';
import { Badge } from '@/components/ui/badge';


const NavCollapsible = ({
  title,
  icon: Icon,
  items,
  basePath,
}: {
  title: string;
  icon: React.ElementType;
  items: { href: string; label: string; badge?: string | number }[];
  basePath: string;
}) => {
  const pathname = usePathname();
  const isBaseActive = pathname.startsWith(`/dashboard/admin/${basePath}`);

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
              href={`/dashboard/admin/${basePath}/${item.href}`}
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                pathname === `/dashboard/admin/${basePath}/${item.href}` && 'bg-accent font-semibold text-accent-foreground'
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-black border-none bg-primary/10 text-primary">
                  {item.badge}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};


export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  const firestore = useFirestore();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);

  const isAdmin = userProfile?.userRole === 'admin' || userProfile?.role === 'admin';

  const usersQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(collection(firestore, 'userProfiles'));
  }, [firestore, isAdmin]);

  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return collection(firestore, 'products');
  }, [firestore, isAdmin]);

  const { data: allProducts } = useCollection<Product>(productsQuery);

  const activeSessionsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(
      collection(firestore, 'liveSessions'),
      where('status', '==', 'live')
    );
  }, [firestore, isAdmin]);

  const { data: activeSessions } = useCollection<LiveSession>(activeSessionsQuery);

  const openTicketsQuery = useMemoFirebase(() => {
    if (!isAdmin || !firestore) return null;
    return query(
      collection(firestore, 'supportTickets'),
      where('status', '!=', 'closed')
    );
  }, [firestore, isAdmin]);

  const { data: openTickets } = useCollection<SupportTicket>(openTicketsQuery);

  const paidOrdersQuery = useMemoFirebase(() => {
      if (!isAdmin || !firestore) return null;
      return query(collection(firestore, 'orders'), where('orderStatus', '==', 'processing'));
  }, [firestore, isAdmin]);

  const { data: paidOrders } = useCollection<Order>(paidOrdersQuery);

  const userStats = useMemo(() => {
    if (!allUsers) return { buyers: 0, sellers: 0, resellers: 0 };
    return {
      buyers: allUsers.filter(u => (u.userRole || u.role) === 'buyer').length,
      sellers: allUsers.filter(u => (u.userRole || u.role) === 'seller').length,
      resellers: allUsers.filter(u => (u.userRole || u.role) === 'reseller').length,
    };
  }, [allUsers]);

  return (
    <>
    <SidebarGroup>
      <SidebarGroupLabel>Vidnov Admin</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={pathname === '/dashboard/admin'}>
            <Link href="/dashboard/admin">
              <LayoutGrid />
              <span>Dashboard</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
         <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/notifications')}>
            <Link href="/dashboard/admin/notifications">
              <Bell />
              <span>Notifications</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        
        <NavCollapsible 
            title="User Management"
            icon={Users2}
            basePath="users"
            items={[
                { href: 'buyers', label: 'Buyers', badge: userStats.buyers },
                { href: 'sellers', label: 'Sellers', badge: userStats.sellers },
                { href: 'resellers', label: 'Resellers', badge: userStats.resellers },
                { href: 'referrals', label: 'Referrals' },
            ]}
        />

        <NavCollapsible 
            title="Asset Management"
            icon={PackageSearch}
            basePath="products"
            items={[
                { href: 'all', label: 'Global Catalog', badge: allProducts?.length || 0 },
            ]}
        />

        <NavCollapsible
            title="Fulfillment"
            icon={ClipboardCheck}
            basePath="orders"
            items={[
                { href: 'all', label: 'Paid Orders', badge: paidOrders?.length || 0 },
            ]}
        />

        <NavCollapsible
          title="Signal Control"
          icon={ScreenShare}
          basePath="live-shopping"
          items={[
            { href: 'sessions', label: 'Live Sessions', badge: activeSessions?.length || 0 },
            { href: 'analytics', label: 'Signal Stats' },
          ]}
        />

        <NavCollapsible
          title="Yield Management"
          icon={CircleDollarSign}
          basePath="finance"
          items={[
            { href: 'payments', label: 'All Transactions' },
          ]}
        />
        
        <NavCollapsible
          title="Support & Safety"
          icon={LifeBuoy}
          basePath="support"
          items={[
            { href: 'help-center', label: 'Academy Manager' },
            { href: 'tickets', label: 'Open Signals', badge: openTickets?.length || 0 },
          ]}
        />

        <NavCollapsible
          title="Neural Control"
          icon={BrainCircuit}
          basePath="ai"
          items={[
            { href: 'about', label: 'AI Status' },
            { href: 'chat', label: 'AI Interface' },
            { href: 'video-generator', label: 'Neural Studio' },
          ]}
        />

        <NavCollapsible
          title="Telemetry"
          icon={BarChart}
          basePath="analytics"
          items={[
            { href: 'users', label: 'Network Growth' },
          ]}
        />
      </SidebarMenu>
    </SidebarGroup>
     <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/account')}>
            <Link href="/dashboard/admin/account">
              <User />
              <span>Admin Profile</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
