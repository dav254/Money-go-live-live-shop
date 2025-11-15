
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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
  const isActive = items.some((item) => pathname === `/dashboard/admin/${basePath}/${item.href}`);

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent text-accent-foreground'
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
                'rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                pathname === `/dashboard/admin/${basePath}/${item.href}` && 'bg-accent font-semibold text-accent-foreground'
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


export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/admin')}>
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
            { href: 'buyers', label: 'Buyers' },
            { href: 'sellers', label: 'Sellers' },
            { href: 'resellers', label: 'Resellers' },
            { href: 'verification', label: 'Verification Requests' },
            { href: 'suspended', label: 'Suspended Accounts' },
          ]}
        />

        <NavCollapsible
          title="Product Management"
          icon={PackageSearch}
          basePath="products"
          items={[
            { href: 'all', label: 'All Products' },
            { href: 'pending', label: 'Pending Approval' },
            { href: 'reported', label: 'Reported Products' },
            { href: 'categories', label: 'Categories' },
            { href: 'tags', label: 'Tags' },
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
            { href: 'analytics', label: 'Sales Analytics' },
            { href: 'commissions', label: 'Commissions' },
            { href: 'seller-payouts', label: 'Seller Payouts' },
            { href: 'reseller-payouts', label: 'Reseller Payouts' },
            { href: 'revenue', label: 'Platform Revenue' },
            { href: 'tax', label: 'Tax Center' },
          ]}
        />

        <NavCollapsible
          title="Marketing & Growth"
          icon={Megaphone}
          basePath="marketing"
          items={[
            { href: 'banners', label: 'Promo Banners' },
            { href: 'posters', label: 'AI Poster Requests' },
            { href: 'sliders', label: 'Homepage Sliders' },
            { href: 'notifications', label: 'Notification Center' },
            { href: 'ads', label: 'Ads Manager' },
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
            { href: 'violations', label: 'Reports & Violations' },
          ]}
        />

        <NavCollapsible
          title="System & Settings"
          icon={Settings}
          basePath="system"
          items={[
            { href: 'roles', label: 'Roles & Permissions' },
            { href: 'security', label: 'Security & 2FA' },
            { href: 'gateways', label: 'Payment Gateways' },
            { href: 'backup', label: 'Backup & Restore' },
            { href: 'api-keys', label: 'API Keys' },
            { href: 'theme', label: 'Themes' },
            { href: 'server-status', label: 'Server Status' },
          ]}
        />
        
        <NavCollapsible
          title="AI Management"
          icon={BrainCircuit}
          basePath="ai"
          items={[
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
            { href: 'revenue', label: 'Revenue Charts' },
            { href: 'activity', label: 'Activity Logs' },
            { href: 'errors', label: 'Error Logs' },
          ]}
        />
      </SidebarMenu>
    </SidebarGroup>
  );
}
