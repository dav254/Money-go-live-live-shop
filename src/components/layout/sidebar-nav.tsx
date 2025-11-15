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
  PlusCircle,
  ShoppingBag,
  AreaChart,
  DollarSign,
  Users,
  Bell,
  Package,
  List,
  Tags,
  Image as ImageIcon,
  Truck,
  CheckCircle,
  XCircle,
  MessageCircleIcon,
  Video,
  Calendar,
  Share2,
  Banknote,
  FileText,
  CreditCard,
  Megaphone,
  Target,
  Share,
  Bot,
  Store,
  MapPin,
  Phone,
  Palette,
  ShieldCheck,
  File,
  HelpCircle,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Waypoints,
  BadgePercent,
  Box,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { ChevronRight } from 'lucide-react';

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

function SidebarCollapsibleItem({ icon, label, children }: { icon: React.ReactNode, label: string, children: React.ReactNode }) {
    const { state } = useSidebar();
    return (
        <Collapsible>
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
  const { state } = useSidebar();
  
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Seller Dashboard</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
            <SidebarCollapsibleItem icon={<AreaChart />} label="Dashboard">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Analytics</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Earnings</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Active Products</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Pending Orders</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Notifications</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
        <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<ShoppingBag />} label="Products / Shop">
                <SidebarMenuSubItem><SidebarMenuSubButton href="/dashboard/products/add">Add Product</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="/sellers/seller-1">My Products</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Categories</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Discounts & Offers</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Product Media</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
         <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<Package />} label="Orders">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">New Orders</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Shipping / Delivery</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Completed</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Cancelled/Returned</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
        <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<MessageCircleIcon />} label="Chat & Messaging">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Inbox</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Live Chat Requests</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Order Chats</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Media</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
        <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<Video />} label="Live Selling">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Start Live Selling</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Upload New Video</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Schedule Live Session</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Shop Button Config</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Share Live Link</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
         <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<Banknote />} label="Finances">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Sales & Payouts</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Revenue Statements</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Tax & Invoice Center</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Payment Accounts</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
         <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<Megaphone />} label="Marketing Tools">
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Promote Product</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Target by Location</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Target by Interests</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Share to Socials</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">AI Poster Creator</SidebarMenuSubButton></SidebarMenuSubItem>
                 <SidebarMenuSubItem><SidebarMenuSubButton href="#">Add Music to Video</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
        <SidebarMenuItem>
             <SidebarCollapsibleItem icon={<Store />} label="Shop Settings">
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
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Help Center</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Contact Support</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">Report an Issue</SidebarMenuSubButton></SidebarMenuSubItem>
                <SidebarMenuSubItem><SidebarMenuSubButton href="#">MoneyGo Academy</SidebarMenuSubButton></SidebarMenuSubItem>
            </SidebarCollapsibleItem>
        </SidebarMenuItem>
      </SidebarMenu>
       <SidebarGroupLabel className="mt-4">Power Features</SidebarGroupLabel>
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarCollapsibleItem icon={<Sparkles />} label="AI Tools">
                    <SidebarMenuSubItem><SidebarMenuSubButton href="/dashboard/products/add">AI Description Writer</SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">AI Image Enhancer</SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">AI Pricing Advisor</SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">AI Keyword Suggestion</SidebarMenuSubButton></SidebarMenuSubItem>
                </SidebarCollapsibleItem>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarCollapsibleItem icon={<Waypoints />} label="Advanced Shop">
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">Inventory Auto-Tracker</SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">GPS Delivery Tracking</SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">Instant Flash Sales</SidebarMenuSubButton></SidebarMenuSubItem>
                    <SidebarMenuSubItem><SidebarMenuSubButton href="#">Bundle Creator</SidebarMenuSubButton></SidebarMenuSubItem>
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
