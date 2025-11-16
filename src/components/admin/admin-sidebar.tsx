
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
  const isActive = (path: string) => pathname.startsWith(path);

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
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/users')}>
                <Link href="/dashboard/admin/users/buyers">
                    <Users2 />
                    <span>User Management</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/products')}>
                <Link href="/dashboard/admin/products/all">
                    <PackageSearch />
                    <span>Product Management</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/orders')}>
                <Link href="/dashboard/admin/orders/all">
                    <Receipt />
                    <span>Orders & Transactions</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/live-shopping')}>
                <Link href="/dashboard/admin/live-shopping/sessions">
                    <ScreenShare />
                    <span>Live Shopping Control</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/finance')}>
                <Link href="/dashboard/admin/finance/analytics">
                    <CircleDollarSign />
                    <span>Finance Management</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/marketing')}>
                <Link href="/dashboard/admin/marketing/banners">
                    <Megaphone />
                    <span>Marketing & Growth</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
        
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/dashboard/admin/support')}>
                <Link href="/dashboard/admin/support/help-center">
                    <LifeBuoy />
                    <span>Support & Moderation</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>

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
     <SidebarMenu className="mt-auto">
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/account')}>
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
