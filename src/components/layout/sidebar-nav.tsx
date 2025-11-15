
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
  Waypoints,
  Bell,
  Search,
  Link2,
  DollarSign,
  Share2,
  Users,
  BadgePercent,
  LineChart,
  CircleDollarSign,
  FolderKanban,
  Bot,
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
        <SidebarMenuButton asChild isActive={isActive('/')}>
          <Link href="/">
            <Home />
            <span>Home</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive('/categories')}>
          <Link href="/categories">
            <LayoutGrid />
            <span>Categories</span>
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
             <SidebarCollapsibleItem icon={<Settings />} label="Shop Settings">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Shop Profile</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Business Location</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Contact & WhatsApp</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Theme Customization</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Security & 2FA</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Policies</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
        <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<HelpCircle />} label="Support & Help">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#"><BookOpen className="mr-2 h-3.5 w-3.5" />Help Center</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#"><MailQuestion className="mr-2 h-3.5 w-3.5" />Contact Support</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#"><ShieldAlert className="mr-2 h-3.5 w-3.5" />Report an Issue</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#"><Sparkles className="mr-2 h-3.5 w-3.5" />MoneyGo Academy</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
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
        <SidebarMenuItem>
          <SidebarCollapsibleItem icon={<Waypoints />} label="Reseller Tools" isActive={isActive('/dashboard/reseller')} defaultOpen>
            <SidebarMenuSubItem><SidebarMenuSubButton href="#" isActive={isActive('/dashboard/reseller/find-products')}><Search className="mr-2 h-3.5 w-3.5" />Find Products</SidebarMenuSubButton></SidebarMenuSubItem>
            <SidebarMenuSubItem><SidebarMenuSubButton href="#" isActive={isActive('/dashboard/reseller/promotions')}><Link2 className="mr-2 h-3.5 w-3.5" />My Promotions</SidebarMenuSubButton></SidebarMenuSubItem>
            <SidebarMenuSubItem><SidebarMenuSubButton href="#" isActive={isActive('/dashboard/reseller/commissions')}><DollarSign className="mr-2 h-3.5 w-3.5" />My Commissions</SidebarMenuSubButton></SidebarMenuSubItem>
            <SidebarMenuSubItem><SidebarMenuSubButton href="#" isActive={isActive('/dashboard/reseller/tools')}><Sparkles className="mr-2 h-3.5 w-3.5" />Promo Tools</SidebarMenuSubButton></SidebarMenuSubItem>
            <SidebarMenuSubItem><SidebarMenuSubButton href="#" isActive={isActive('/dashboard/reseller/share')}><Share2 className="mr-2 h-3.5 w-3.5" />Share Center</SidebarMenuSubButton></SidebarMenuSubItem>
          </SidebarCollapsibleItem>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}


export function AccountSidebarNav() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="#">
            <User />
            <span>Account</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link href="#">
            <Settings />
            <span>Settings</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
