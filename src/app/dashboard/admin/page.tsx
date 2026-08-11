'use client';

import React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Users2,
  Store,
  ShoppingCart,
  Wallet,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  Hourglass,
  Loader,
  CheckCircle,
  Truck,
  AlertTriangle,
  Home,
  Megaphone,
  FileText,
  ShieldCheck,
  UserPlus,
  Video,
  DollarSign
} from 'lucide-react';
import { useUserProfile, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import type { UserProfile, Order, Payment, Video as VideoType, LiveSession } from '@/lib/types';
import { PlatformActivityChart, PlatformActivityData } from '@/components/admin/platform-activity-chart';
import { RevenueOverview } from '@/components/admin/revenue-overview';
import { FulfillmentPipeline } from '@/components/admin/fulfillment-pipeline';
import { LiveNow } from '@/components/admin/live-now';
import { RecentActivity } from '@/components/admin/recent-activity';

const DashboardKpiCard = ({
  title,
  value,
  icon: Icon,
  percentageChange,
  isLoading
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  percentageChange: string;
  isLoading: boolean;
}) => (
  <Card className="bg-card shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <>
            <Skeleton className="h-8 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/4" />
        </>
      ) : (
        <>
          <div className="text-3xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{percentageChange}</p>
        </>
      )}
    </CardContent>
  </Card>
);


// Helper to create a date range for queries
const lastNDays = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

// Quick Actions Component
const QuickActionItem = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) => (
    <Button asChild variant="ghost" className="w-full justify-start">
        <Link href={href} className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
        </Link>
    </Button>
);


export default function AdminDashboardPage() {
  const { user } = useUserProfile();
  const firestore = useFirestore();
  const [lastUpdated, setLastUpdated] = React.useState(new Date());

  const isAdmin = user?.userRole === 'admin';

  // --- DATA QUERIES ---
  const { start } = lastNDays(7);
  const { start: todayStart } = lastNDays(0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0,0,0,0);

  const usersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'userProfiles')) : null, [firestore, isAdmin]);
  const sellersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'userProfiles'), where('role', '==', 'seller')) : null, [firestore, isAdmin]);
  const ordersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'orders')) : null, [firestore, isAdmin]);
  const revenueQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'payments'), where('paymentStatus', '==', 'succeeded')) : null, [firestore, isAdmin]);
  const liveSessionsQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'liveSessions'), where('status', '==', 'live')) : null, [firestore, isAdmin]);

  const newUsersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'userProfiles'), where('createdAt', '>=', Timestamp.fromDate(start))) : null, [firestore, isAdmin, start]);
  const newSellersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'userProfiles'), where('role', '==', 'seller'), where('createdAt', '>=', Timestamp.fromDate(start))) : null, [firestore, isAdmin, start]);
  const newOrdersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'orders'), where('orderDate', '>=', Timestamp.fromDate(start))) : null, [firestore, isAdmin, start]);
  const newRevenueQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'payments'), where('paymentStatus', '==', 'succeeded'), where('paymentDate', '>=', Timestamp.fromDate(start))) : null, [firestore, isAdmin, start]);
  const newVideosQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'videos'), where('createdAt', '>=', Timestamp.fromDate(start))) : null, [firestore, isAdmin, start]);
  
  const todayUsersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'userProfiles'), where('createdAt', '>=', Timestamp.fromDate(todayStart))) : null, [firestore, isAdmin, todayStart]);
  const todaySellersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'userProfiles'), where('role', '==', 'seller'), where('createdAt', '>=', Timestamp.fromDate(todayStart))) : null, [firestore, isAdmin, todayStart]);
  const todayOrdersQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'orders'), where('orderDate', '>=', Timestamp.fromDate(todayStart))) : null, [firestore, isAdmin, todayStart]);
  const todayRevenueQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'payments'), where('paymentStatus', '==', 'succeeded'), where('paymentDate', '>=', Timestamp.fromDate(todayStart))) : null, [firestore, isAdmin, todayStart]);

  const monthRevenueQuery = useMemoFirebase(() => isAdmin ? query(collection(firestore, 'payments'), where('paymentStatus', '==', 'succeeded'), where('paymentDate', '>=', Timestamp.fromDate(monthStart))) : null, [firestore, isAdmin, monthStart]);


  // --- DATA FETCHING ---
  const { data: allUsers, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);
  const { data: sellers, isLoading: sellersLoading } = useCollection<UserProfile>(sellersQuery);
  const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);
  const { data: payments, isLoading: revenueLoading } = useCollection<Payment>(revenueQuery);
  const { data: liveSessions, isLoading: liveSessionsLoading } = useCollection<LiveSession>(liveSessionsQuery);
  const { data: newUsers, isLoading: newUsersLoading } = useCollection<UserProfile>(newUsersQuery);
  const { data: newSellers, isLoading: newSellersLoading } = useCollection<UserProfile>(newSellersQuery);
  const { data: newOrders, isLoading: newOrdersLoading } = useCollection<Order>(newOrdersQuery);
  const { data: newRevenue, isLoading: newRevenueLoading } = useCollection<Payment>(newRevenueQuery);
  const { data: newVideos, isLoading: newVideosLoading } = useCollection<VideoType>(newVideosQuery);
  const { data: monthRevenue, isLoading: monthRevenueLoading } = useCollection<Payment>(monthRevenueQuery);
  
  const { data: todayUsers, isLoading: todayUsersLoading } = useCollection<UserProfile>(todayUsersQuery);
  const { data: todaySellers, isLoading: todaySellersLoading } = useCollection<UserProfile>(todaySellersQuery);
  const { data: todayOrders, isLoading: todayOrdersLoading } = useCollection<Order>(todayOrdersQuery);
  const { data: todayRevenue, isLoading: todayRevenueLoading } = useCollection<Payment>(todayRevenueQuery);


  // --- DATA PROCESSING ---
  const totalRevenue = React.useMemo(() => payments ? payments.reduce((sum, payment) => sum + payment.amount, 0) : 0, [payments]);
  const totalMonthRevenue = React.useMemo(() => monthRevenue ? monthRevenue.reduce((sum, payment) => sum + payment.amount, 0) : 0, [monthRevenue]);
  const totalTodayRevenue = React.useMemo(() => todayRevenue ? todayRevenue.reduce((sum, p) => p.amount + sum, 0) : 0, [todayRevenue]);

  const kpiData = [
    { title: 'Total Users', value: (allUsers?.length || 0).toLocaleString(), percentageChange: `+${todayUsers?.length || 0} today`, icon: Users2, isLoading: usersLoading || todayUsersLoading },
    { title: 'Active Sellers', value: (sellers?.length || 0).toLocaleString(), percentageChange: `+${todaySellers?.length || 0} today`, icon: Store, isLoading: sellersLoading || todaySellersLoading },
    { title: 'Orders', value: (orders?.length || 0).toLocaleString(), percentageChange: `+${todayOrders?.length || 0} today`, icon: ShoppingCart, isLoading: ordersLoading || todayOrdersLoading },
    { title: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, percentageChange: `$${totalTodayRevenue.toLocaleString()} today`, icon: Wallet, isLoading: revenueLoading || todayRevenueLoading },
  ];

  const fulfillmentData = React.useMemo(() => [
        { status: 'Awaiting Action', count: orders?.filter(o => o.orderStatus === 'pending').length || 0, icon: Hourglass },
        { status: 'Processing', count: orders?.filter(o => o.orderStatus === 'processing').length || 0, icon: Loader },
        { status: 'Ready for Dispatch', count: orders?.filter(o => o.orderStatus === 'shipped').length || 0, icon: Truck },
        { status: 'Completed', count: orders?.filter(o => o.orderStatus === 'completed').length || 0, icon: CheckCircle },
        { status: 'Disputed', count: orders?.filter(o => o.orderStatus === 'disputed').length || 0, icon: AlertTriangle },
    ], [orders]);

  const revenueBreakdownData = React.useMemo(() => [
        { source: 'Boosts', amount: 2840, fill: 'bg-blue-500' },
        { source: 'Commissions', amount: 3120, fill: 'bg-green-500' },
        { source: 'Subscriptions', amount: 1460, fill: 'bg-purple-500' },
        { source: 'Ads', amount: 1001, fill: 'bg-orange-500' },
  ], []);

  const quickActionsData = [
      { href: '#', label: 'Manage Homepage Grid', icon: Home },
      { href: '#', label: 'Ads Manager', icon: Megaphone },
      { href: '#', label: 'Platform Broadcast', icon: FileText },
      { href: '#', label: 'Review Reports', icon: AlertTriangle },
      { href: '#', label: 'Moderate Content', icon: ShieldCheck }
  ];

   const recentActivityData = [
        { icon: <UserPlus className="h-4 w-4 text-blue-500" />, description: 'New seller verified', details: 'John Electronics', time: '2 min ago' },
        { icon: <CheckCircle className="h-4 w-4 text-green-500" />, description: 'Order #VN-20481 completed', details: 'KSh 4,800', time: '7 min ago' },
        { icon: <Video className="h-4 w-4 text-orange-500" />, description: 'Video flagged for review', details: 'Asset #VID-8192', time: '12 min ago' },
        { icon: <DollarSign className="h-4 w-4 text-yellow-500" />, description: 'Withdrawal requested', details: 'KSh 12,500', time: '18 min ago' },
        { icon: <UserPlus className="h-4 w-4 text-purple-500" />, description: 'New buyer registered', details: 'Nairobi', time: '24 min ago' },
    ];

  const liveStreamData = {
        thumbnailUrl: '/placeholder.svg', // Replace with actual thumbnail
        sellerName: 'John Electronics',
        viewers: 127,
        products: 14
  };

  const activityData: PlatformActivityData[] = React.useMemo(() => {
    const data: PlatformActivityData[] = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toLocaleDateString('en-US', { weekday: 'short' });

        const isSameDay = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

        data.push({
            date: dateString,
            Users: newUsers?.filter(u => isSameDay(u.createdAt?.toDate(), date)).length || 0,
            Sellers: newSellers?.filter(s => isSameDay(s.createdAt?.toDate(), date)).length || 0,
            Orders: newOrders?.filter(o => isSameDay(o.orderDate?.toDate(), date)).length || 0,
            Revenue: newRevenue?.filter(p => isSameDay(p.paymentDate?.toDate(), date)).reduce((acc, p) => acc + p.amount, 0) || 0,
            'Video Uploads': newVideos?.filter(v => isSameDay(v.createdAt?.toDate(), date)).length || 0,
        });
    }
    return data;
  }, [newUsers, newSellers, newOrders, newRevenue, newVideos]);


  const handleRefresh = () => setLastUpdated(new Date());

  const isLoading = usersLoading || sellersLoading || ordersLoading || revenueLoading || liveSessionsLoading || newUsersLoading || newSellersLoading || newOrdersLoading || newRevenueLoading || newVideosLoading || monthRevenueLoading || todayUsersLoading || todaySellersLoading || todayOrdersLoading || todayRevenueLoading;


  return (
    <AdminLayout>
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2">
            <div>
                <p className="text-sm font-semibold text-muted-foreground">VIDNOV ADMIN</p>
                <h1 className="font-bold text-3xl tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                    Good afternoon, {user?.displayName || 'Administrator'}. Here's what's happening across Vidnov today.
                </p>
            </div>
            <div className="flex items-center space-x-2">
                <p className="text-xs text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</p>
                <Button variant="ghost" size="icon" onClick={handleRefresh}><RefreshCw className="h-4 w-4"/></Button>
                <Button variant="outline" className="flex items-center gap-2">
                    Today <ChevronDown className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map(kpi => <DashboardKpiCard key={kpi.title} {...kpi} isLoading={isLoading} />)}
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2">
                 <PlatformActivityChart data={activityData} isLoading={isLoading} />
            </div>
            
             <Card className="w-full lg:col-span-1">
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Common administrative tasks.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    {quickActionsData.map(action => (
                        <QuickActionItem key={action.label} {...action} />
                    ))}
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <FulfillmentPipeline pipelineData={fulfillmentData} isLoading={isLoading} />
            <RevenueOverview 
                totalRevenue={totalMonthRevenue}
                percentageChange={'+9.4% this month'} // Placeholder
                revenueBreakdown={revenueBreakdownData}
                isLoading={isLoading}
            />
        </div>

         <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <LiveNow isLive={liveSessions && liveSessions.length > 0} isLoading={isLoading} stream={liveStreamData} />
            <RecentActivity activities={recentActivityData} isLoading={isLoading} />
        </div>

      </div>
    </AdminLayout>
  );
}
