
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
  KeyRound,
  Server,
  Palette,
  Bot,
  BarChart,
  Activity,
  LineChart,
  FileCheck,
  ShieldX,
  ShieldAlert,
  Folder,
  Tags,
  Truck,
  CircleDollarSign,
  Receipt,
  Megaphone,
  SlidersHorizontal,
  Bell,
  Target,
  LifeBuoy,
  Database,
  Search,
  Clock,
  Ticket,
  Lock,
  CreditCard,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';


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
              <Home />
              <span>Home</span>
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


export function AdminSidebarNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive('/dashboard/admin')}>
            <Link href="/dashboard/admin">
              <Home />
              <span>Dashboard</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <NavCollapsible
          title="User Management"
          icon={Users}
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
          icon={ShoppingBag}
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
          icon={Package}
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
          icon={Video}
          basePath="live-shopping"
          items={[
            { href: 'sessions', label: 'Active Live Sessions' },
            { href: 'approved', label: 'Approved Streams' },
            { href: 'flagged', label: 'Flagged Streams' },
            { href: 'analytics', label: 'Live Stream Analytics' },
          ]}
        />

        <NavCollapsible
          title="Finance Management"
          icon={CircleDollarSign}
          basePath="finance"
          items={[
            { href: 'analytics', label: 'Sales Analytics' },
            { href: 'commissions', label: 'Commissions Overview' },
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
            { href: 'banners', label: 'Banner Manager' },
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
            { href: 'violations', label: 'Violations & Reports' },
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
          icon={Bot}
          basePath="ai"
          items={[
            { href: 'recommendations', label: 'AI Recommendation Engine' },
            { href: 'fraud-detection', label: 'AI Fraud Detection' },
            { href: 'content-moderation', label: 'AI Content Moderation' },
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
