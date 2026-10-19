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
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useUserProfile } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { UserProfile, Product, Order, Payout, Payment, LiveSession, SupportTicket, ActivityLog, ErrorLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useAdminComplaintCounts } from '@/hooks/use-admin-complaints';


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
  const isBaseActive = !!pathname && pathname.startsWith(`/dashboard/admin/${basePath}`);
  // Absolute hrefs are used as-is (they point outside this group's basePath);
  // relative ones live under /dashboard/admin/<basePath>/.
  const resolve = (href: string) =>
    href.startsWith('/') ? href : `/dashboard/admin/${basePath}${href ? `/${href}` : ''}`;

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
              href={resolve(item.href)}
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                pathname === resolve(item.href) && 'bg-accent font-semibold text-accent-foreground'
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
  const isActive = (path: string) => !!pathname && pathname.startsWith(path);
  const firestore = useFirestore();

  // Gate ALL badge subscriptions behind the verified-admin flag: subscribing
  // to admin-only collections before auth/role resolves triggers Firestore
  // permission denials (auth:null) and the global error boundary.
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const adminReady = !!user && !isProfileLoading &&
    (userProfile?.userRole === 'admin' || userProfile?.role === 'admin');

  // --- Real-time User Counts ---
  const usersQuery = useMemoFirebase(
    () => (adminReady ? query(collection(firestore, 'userProfiles')) : null),
    [firestore, adminReady],
  );
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  // --- Real-time Product Counts ---
  const productsQuery = useMemoFirebase(
    () => (adminReady ? collection(firestore, 'products') : null),
    [firestore, adminReady],
  );
  const { data: allProducts } = useCollection<Product>(productsQuery);

  // Complaint badges used to be three live Firestore listeners; the deployed
  // rules deny client `list` on `complaints`, so every admin page was firing
  // permission-error toasts just to draw a badge. One Admin-SDK count request
  // replaces all three (badges don't need to be real-time).
  const { counts: complaintCounts } = useAdminComplaintCounts();

  // --- Real-time Order Counts ---
  const ordersQuery = useMemoFirebase(
    () => (adminReady ? collection(firestore, 'orders') : null),
    [firestore, adminReady],
  );
  const { data: allOrders } = useCollection<Order>(ordersQuery);

  // --- Real-time Finance Counts ---
  const payoutsQuery = useMemoFirebase(
    () => (adminReady ? collection(firestore, 'payouts') : null),
    [firestore, adminReady],
  );
  const { data: allPayouts } = useCollection<Payout>(payoutsQuery);

  const paymentsQuery = useMemoFirebase(
    () => (adminReady ? collection(firestore, 'payments') : null),
    [firestore, adminReady],
  );
  const { data: allPayments } = useCollection<Payment>(paymentsQuery);

  // --- Real-time Live Shopping Counts ---
  const activeSessionsQuery = useMemoFirebase(() => (
    adminReady ? query(
    collection(firestore, 'liveSessions'),
    where('status', '==', 'live')
  ) : null), [firestore, adminReady]);
  const { data: activeSessions } = useCollection<LiveSession>(activeSessionsQuery);

  // --- Real-time Support Counts ---
  const openTicketsQuery = useMemoFirebase(() => (
    adminReady ? query(
    collection(firestore, 'supportTickets'),
    where('status', '!=', 'closed')
  ) : null), [firestore, adminReady]);
  const { data: openTickets } = useCollection<SupportTicket>(openTicketsQuery);

  // --- Real-time Logs & Analytics Counts ---
  const activityLogsQuery = useMemoFirebase(
    () => (adminReady ? collection(firestore, 'activityLogs') : null),
    [firestore, adminReady],
  );
  const { data: allActivityLogs } = useCollection<ActivityLog>(activityLogsQuery);

  const newErrorLogsQuery = useMemoFirebase(() => (
    adminReady ? query(
    collection(firestore, 'errorLogs'),
    where('status', '==', 'new')
  ) : null), [firestore, adminReady]);
  const { data: newErrorLogs } = useCollection<ErrorLog>(newErrorLogsQuery);

  // Memoize counts for performance
  const userStats = useMemo(() => {
    if (!allUsers) return { admins: 0, buyers: 0, sellers: 0, resellers: 0, verification: 0, suspended: 0 };
    return {
      admins: allUsers.filter(u => (u.userRole || u.role) === 'admin').length,
      buyers: allUsers.filter(u => (u.userRole || u.role) === 'buyer').length,
      sellers: allUsers.filter(u => (u.userRole || u.role) === 'seller').length,
      resellers: allUsers.filter(u => (u.userRole || u.role) === 'reseller').length,
      verification: allUsers.filter(u => u.verificationStatus === 'pending').length,
      suspended: allUsers.filter(u => u.status === 'suspended').length,
    };
  }, [allUsers]);

  const productStats = useMemo(() => ({
    total: allProducts?.length || 0,
    reported: complaintCounts.openProducts
  }), [allProducts, complaintCounts.openProducts]);

  const orderStats = useMemo(() => {
    if (!allOrders) return { total: 0, reseller: 0, disputes: 0, tracking: 0 };
    return {
      total: allOrders.length,
      reseller: allOrders.filter(o => !!o.resellerId).length,
      disputes: allOrders.filter(o => o.orderStatus === 'disputed').length,
      tracking: allOrders.filter(o => o.orderStatus === 'shipped' || o.orderStatus === 'delivery').length,
    };
  }, [allOrders]);

  const financeStats = useMemo(() => {
    if (!allPayouts) return { pendingPayouts: 0, totalPayments: 0 };
    return {
        pendingPayouts: allPayouts.filter(p => p.status === 'pending').length,
        totalPayments: allPayments?.length || 0,
    };
  }, [allPayouts, allPayments]);

  const liveStats = useMemo(() => ({
    active: activeSessions?.length || 0,
    flagged: complaintCounts.openUsers
  }), [activeSessions, complaintCounts.openUsers]);

  const supportStats = useMemo(() => ({
    tickets: openTickets?.length || 0,
    complaints: complaintCounts.open
  }), [openTickets, complaintCounts.open]);

  const logStats = useMemo(() => ({
    activity: allActivityLogs?.length || 0,
    errors: newErrorLogs?.length || 0
  }), [allActivityLogs, newErrorLogs]);

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
         <NavCollapsible 
            title="User Management"
            icon={Users2}
            basePath="users"
            items={[
                { href: 'admins', label: 'Admins', badge: userStats.admins },
                { href: 'buyers', label: 'Buyers', badge: userStats.buyers },
                { href: 'sellers', label: 'Sellers', badge: userStats.sellers },
                { href: 'resellers', label: 'Resellers', badge: userStats.resellers },
                { href: 'referrals', label: 'Referrals' },
                { href: 'suspended', label: 'Suspended', badge: userStats.suspended },
                { href: 'verification', label: 'Verification', badge: userStats.verification },
                // Absolute href: the tiers page lives at /dashboard/admin/tiers,
                // not under users/ — a relative 'tiers' under basePath "users" 404'd.
                { href: '/dashboard/admin/tiers', label: 'Tiers & bonuses' },
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
            { href: 'all', label: 'All Orders', badge: orderStats.total },
            { href: 'seller-orders', label: 'Seller Orders' },
            { href: 'reseller-orders', label: 'Reseller Orders', badge: orderStats.reseller },
            { href: 'disputes', label: 'Refunds & Disputes', badge: orderStats.disputes },
            { href: 'tracking', label: 'Delivery Tracking', badge: orderStats.tracking },
          ]}
        />
        
        <NavCollapsible
          title="Live Shopping Control"
          icon={ScreenShare}
          basePath="live-shopping"
          items={[
            { href: 'sessions', label: 'Live Sessions', badge: liveStats.active },
            { href: 'approved', label: 'Approved Streams' },
            { href: 'flagged', label: 'Flagged Streams', badge: liveStats.flagged },
            { href: 'analytics', label: 'Live Analytics' },
          ]}
        />

        <NavCollapsible
          title="Finance Management"
          icon={CircleDollarSign}
          basePath="finance"
          items={[
            { href: 'analytics', label: 'Financial Analytics' },
            { href: 'payments', label: 'All Payments', badge: financeStats.totalPayments },
            { href: 'invoices', label: 'Invoice Generator' },
            { href: 'commissions', label: 'Commissions' },
            { href: 'payouts', label: 'Payout Requests', badge: financeStats.pendingPayouts },
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
          ]}
        />
        
        <NavCollapsible
          title="Support & Moderation"
          icon={LifeBuoy}
          basePath="support"
          items={[
            { href: 'help-center', label: 'Help Center Manager' },
            { href: 'tickets', label: 'Support Tickets', badge: supportStats.tickets },
            { href: 'chat-logs', label: 'Chat Logs' },
            // The oversight view the moderation consoles were missing: every
            // seller↔buyer chat, readable in place. Linked from Seller & Buyer
            // Issues' "View conversation" action too.
            { href: 'conversations', label: 'Seller & Buyer Chats' },
            { href: 'complaints', label: 'Resolve Complaints', badge: supportStats.complaints },
            { href: 'seller-buyer-issues', label: 'Seller & Buyer Issues' },
          ]}
        />

        <NavCollapsible
          title="System & Settings"
          icon={Settings}
          basePath="system"
          items={[
            { href: 'roles', label: 'Roles & Permissions' },
            { href: 'whatsapp-alerts', label: 'WhatsApp Alerts' },
            { href: 'security', label: 'Security & 2FA' },
            { href: 'backup', label: 'Backup & Restore' },
            { href: 'server-status', label: 'Server Status' },
            { href: 'media-storage', label: 'Media Storage' },
            { href: 'email', label: 'Email Delivery' },
            { href: 'app', label: 'App Manager' },
          ]}
        />

        <NavCollapsible
          title="Communication"
          icon={Mail}
          basePath="communication"
          items={[
            { href: '', label: 'Communication Center' },
          ]}
        />

        <NavCollapsible
          title="AI Management"
          icon={BrainCircuit}
          basePath="ai"
          items={[
            { href: 'center', label: 'AI Center' },
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
            { href: 'users', label: 'User Analytics', badge: userStats.buyers + userStats.sellers + userStats.resellers },
            { href: 'activity', label: 'User Activity Logs', badge: logStats.activity },
            { href: 'errors', label: 'Frontend', badge: logStats.errors },
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
