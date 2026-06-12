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
  Receipt,
  ScreenShare,
  CircleDollarSign,
  Megaphone,
  LifeBuoy,
  Settings,
  BrainCircuit,
  BarChart,
  User,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile, Product, Complaint } from '@/lib/types';
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

  // --- Real-time User Counts ---
  const usersQuery = useMemoFirebase(() => query(collection(firestore, 'userProfiles')), [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  // --- Real-time Product Counts ---
  const productsQuery = useMemoFirebase(() => collection(firestore, 'products'), [firestore]);
  const { data: allProducts } = useCollection<Product>(productsQuery);

  const reportedQuery = useMemoFirebase(() => query(
    collection(firestore, 'complaints'), 
    where('targetType', '==', 'product'),
    where('status', '==', 'open')
  ), [firestore]);
  const { data: reportedProducts } = useCollection<Complaint>(reportedQuery);

  // Memoize counts for performance
  const userStats = useMemo(() => {
    if (!allUsers) return { buyers: 0, sellers: 0, resellers: 0, verification: 0, suspended: 0 };
    return {
      buyers: allUsers.filter(u => (u.userRole || u.role) === 'buyer').length,
      sellers: allUsers.filter(u => (u.userRole || u.role) === 'seller').length,
      resellers: allUsers.filter(u => (u.userRole || u.role) === 'reseller').length,
      verification: allUsers.filter(u => u.verificationStatus === 'pending').length,
      suspended: allUsers.filter(u => u.status === 'suspended').length,
    };
  }, [allUsers]);

  const productStats = useMemo(() => ({
    total: allProducts?.length || 0,
    reported: reportedProducts?.length || 0
  }), [allProducts, reportedProducts]);

  return (
    <>
    <SidebarGroup>
      <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
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
                { href: 'suspended', label: 'Suspended', badge: userStats.suspended },
                { href: 'verification', label: 'Verification', badge: userStats.verification },
            ]}
        />

        <NavCollapsible 
            title="Product Management"
            icon={PackageSearch}
            basePath="products"
            items={[
                { href: 'all', label: 'All Products', badge: productStats.total },
                { href: 'reported', label: 'Reported', badge: productStats.reported },
            ]}
        />

        <NavCollapsible
          title="Orders & Transactions"
          icon={Receipt}
          basePath="orders"
          items={[
            { href: 'all', label: 'All Orders' },
            { href: 'seller-orders', label: 'Seller Orders' },
            { href: 'reseller-orders', label: 'Reseller Orders' },
            { href: 'disputes', label: 'Refunds & Disputes' },
            { href: 'tracking', label: 'Delivery Tracking' },
          ]}
        />
        
        <NavCollapsible
          title="Live Shopping Control"
          icon={ScreenShare}
          basePath="live-shopping"
          items={[
            { href: 'sessions', label: 'Live Sessions' },
            { href: 'approved', label: 'Approved Streams' },
            { href: 'flagged', label: 'Flagged Streams' },
            { href: 'analytics', label: 'Live Analytics' },
          ]}
        />

        <NavCollapsible
          title="Finance Management"
          icon={CircleDollarSign}
          basePath="finance"
          items={[
            { href: 'analytics', label: 'Financial Analytics' },
            { href: 'payments', label: 'All Payments' },
            { href: 'invoices', label: 'Invoice Generator' },
            { href: 'commissions', label: 'Commissions' },
            { href: 'payouts', label: 'Payout Requests' },
            { href: 'tax', label: 'Tax Center' },
          ]}
        />
        
        <NavCollapsible
          title="Marketing & Growth"
          icon={Megaphone}
          basePath="marketing"
          items={[
            { href: 'ads', label: 'Ads Manager' },
            { href: 'boosts', label: 'TikTok Boosts' },
            { href: 'banners', label: 'Promo Banners' },
            { href: 'sliders', label: 'Homepage Sliders' },
            { href: 'notifications', label: 'Notification Center' },
          ]}
        />
        
        <NavCollapsible
          title="Support & Moderation"
          icon={LifeBuoy}
          basePath="support"
          items={[
            { href: 'help-center', label: 'Help Center Manager' },
            { href: 'tickets', label: 'Support Tickets' },
            { href: 'chat-logs', label: 'Chat Logs' },
            { href: 'complaints', label: 'Resolve Complaints' },
          ]}
        />

        <NavCollapsible
          title="System & Settings"
          icon={Settings}
          basePath="system"
          items={[
            { href: 'roles', label: 'Roles & Permissions' },
            { href: 'security', label: 'Security & 2FA' },
            { href: 'backup', label: 'Backup & Restore' },
            { href: 'server-status', label: 'Server Status' },
          ]}
        />
        
        <NavCollapsible
          title="AI Management"
          icon={BrainCircuit}
          basePath="ai"
          items={[
            { href: 'about', label: 'About Go-AI' },
            { href: 'chat', label: 'AI Chat' },
            { href: 'video-generator', label: 'AI Video Studio' },
            { href: 'recommendations', label: 'Recommendation Engine' },
            { href: 'fraud-detection', label: 'Fraud Detection' },
            { href: 'content-moderation', label: 'Content Moderation' },
          ]}
        />

        <NavCollapsible
          title="Logs & Analytics"
          icon={BarChart}
          basePath="analytics"
          items={[
            { href: 'revenue', label: 'Sales Analytics' },
            { href: 'users', label: 'User Analytics' },
            { href: 'activity', label: 'User Activity Logs' },
            { href: 'errors', label: 'Frontend' },
          ]}
        />
      </SidebarMenu>
    </SidebarGroup>
     <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/account')}>
            <Link href="/dashboard/admin/account">
              <User />
              <span>Account</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}