'use client';

import React, { Suspense, useMemo, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useUserProfile } from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import type { LiveSession, UserProfile, Product, Order } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowRight, Activity, ShieldAlert, ScreenShare, Megaphone, AlertTriangle } from 'lucide-react';
import { PlatformHealthStrip } from '@/components/admin/platform-health-strip';

const mockSalesChartData = [
  { date: '2025-12-08', revenue: 0, orders: 0 },
  { date: '2025-12-09', revenue: 0, orders: 0 },
  { date: '2025-12-10', revenue: 0, orders: 0 },
  { date: '2025-12-11', revenue: 0, orders: 0 },
  { date: '2025-12-12', revenue: 0, orders: 0 },
  { date: '2025-12-13', revenue: 0, orders: 0 },
  { date: '2025-12-14', revenue: 0, orders: 0 },
];

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#FF4D2E',
  },
};

const RecentSaleRow = ({ order }: { order: Order }) => {
  const firestore = useFirestore();
  const buyerProfileRef = useMemoFirebase(() => {
    if (!firestore || !order.buyerId) return null;
    return doc(firestore, 'userProfiles', order.buyerId);
  }, [firestore, order.buyerId]);
  const { data: buyer, isLoading } = useDoc<UserProfile>(buyerProfileRef);

  if (isLoading) {
    return (
      <TableRow>
        <TableCell><Skeleton className="vn-skeleton h-5 w-32" /></TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Skeleton className="vn-skeleton h-6 w-6 rounded-full" />
            <Skeleton className="vn-skeleton h-4 w-16" />
          </div>
        </TableCell>
        <TableCell className="text-right"><Skeleton className="vn-skeleton h-5 w-16 ml-auto" /></TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow key={order.id}>
      <TableCell className="font-medium">{order.productName}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={buyer?.profilePictureUrl} />
            <AvatarFallback>{buyer?.fullName?.[0] || 'U'}</AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">{buyer?.fullName || 'Unknown buyer'}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-grotesk font-semibold">
        ${(order.totalAmount ?? order.productPrice ?? 0).toLocaleString()}
      </TableCell>
    </TableRow>
  );
};

export default function AdminDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [salesChartData, setSalesChartData] = useState(mockSalesChartData);
  const [pendingPayoutsTotal, setPendingPayoutsTotal] = useState(0);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isPayoutsLoading, setIsPayoutsLoading] = useState(true);
  // True when Firestore could not be read (e.g. the Spark plan's daily read
  // cap was reached). Shown as a banner so zeros are never mistaken for
  // "no revenue today".
  const [isAnalyticsDegraded, setIsAnalyticsDegraded] = useState(false);

  // Admin-only queries must wait until auth + role are resolved, or the
  // rules deny them (auth:null) and the error boundary fires.
  const { userProfile } = useUserProfile(user?.uid);
  const isAdmin = userProfile?.userRole === 'admin' || userProfile?.role === 'admin';
  const adminReady = !!user && !!isAdmin;

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(collection(firestore, 'userProfiles'));
  }, [firestore, adminReady]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<UserProfile>(usersQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(collection(firestore, 'products'));
  }, [firestore, adminReady]);
  const { data: allProducts, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const liveSessionsQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
  }, [firestore, adminReady]);
  const { data: liveSessions, isLoading: areLiveSessionsLoading } = useCollection<LiveSession>(liveSessionsQuery);

  const recentOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !adminReady) return null;
    return query(collection(firestore, 'orders'), orderBy('orderDate', 'desc'), limit(5));
  }, [firestore, adminReady]);
  const { data: recentOrders, isLoading: areRecentOrdersLoading } = useCollection<Order>(recentOrdersQuery);

  useEffect(() => {
    const fetchSalesData = async () => {
      if (!user) return;
      setIsChartLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/sales-analytics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch sales data');
        setIsAnalyticsDegraded(response.headers.get('X-Vidnov-Degraded') === 'firestore-unavailable');
        const data = await response.json();
        setSalesChartData(data);
      } catch (error) {
        // `console.warn`, not `console.error`: Next's dev overlay escalates
        // console.error into a full-screen error even though this is a caught,
        // already-handled fallback. The dashboard degrading to an empty chart is
        // not an application error.
        console.warn('[admin] sales analytics unavailable, showing empty chart:', error);
        setSalesChartData(mockSalesChartData);
      } finally {
        setIsChartLoading(false);
      }
    };
    fetchSalesData();
  }, [user]);

  useEffect(() => {
    const fetchPayoutData = async () => {
      if (!user) return;
      setIsPayoutsLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/payout-analytics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch payout data');
        setIsAnalyticsDegraded((prev) => prev || response.headers.get('X-Vidnov-Degraded') === 'firestore-unavailable');
        const data = await response.json();
        setPendingPayoutsTotal(data.totalPending);
      } catch (error) {
        // See above: warn, not error, so a caught fallback does not trip the
        // dev overlay and cover the whole dashboard.
        console.warn('[admin] payout analytics unavailable:', error);
        setPendingPayoutsTotal(0);
      } finally {
        setIsPayoutsLoading(false);
      }
    };
    fetchPayoutData();
  }, [user]);

  const todaysStats = useMemo(() => {
    if (!salesChartData || salesChartData.length === 0) return { revenue: 0, orders: 0 };
    const today = new Date().toISOString().split('T')[0];
    const todayData = salesChartData.find((d) => d.date === today);
    return { revenue: todayData?.revenue || 0, orders: todayData?.orders || 0 };
  }, [salesChartData]);

  const totalUsers = allUsers?.length || 0;
  const totalProducts = allProducts?.length || 0;
  const totalBusinesses = allUsers?.filter((u) => (u.userRole || u.role) === 'seller').length || 0;

  /* Command-center metric grid */
  const metrics = [
    { label: 'USERS', value: totalUsers, loading: areUsersLoading, href: '/dashboard/admin/users/buyers' },
    { label: 'BUSINESSES', value: totalBusinesses, loading: areUsersLoading, href: '/dashboard/admin/users/sellers' },
    { label: "TODAY'S REVENUE", value: `$${todaysStats.revenue.toLocaleString()}`, loading: isChartLoading, href: '/dashboard/admin/analytics/revenue' },
    { label: 'LIVE STREAMS', value: liveSessions?.length || 0, loading: areLiveSessionsLoading, href: '/dashboard/admin/live-shopping/sessions', accent: liveSessions && liveSessions.length > 0 },
    { label: 'PRODUCTS', value: totalProducts, loading: areProductsLoading, href: '/dashboard/admin/products/all' },
    { label: 'PENDING PAYOUTS', value: `$${pendingPayoutsTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, loading: isPayoutsLoading, href: '/dashboard/admin/finance/payouts' },
  ];

  return (
    <AdminLayout>
      <div className="vn-page-enter flex-1 space-y-10 p-4 md:p-8 lg:p-10 max-w-7xl">
        {/* Header + measured platform health (replaces the hardcoded badge) */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Vidnov Control
          </p>
          <PlatformHealthStrip enabled={adminReady} />
        </div>

        {isAnalyticsDegraded && (
          <p className="flex items-start gap-2 border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-foreground/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              Analytics below could not be read from the database and are shown as
              zero. This usually means the Firebase project hit its daily read quota
              — upgrade the project to the Blaze plan to lift it.
            </span>
          </p>
        )}

        {/* Metric grid — oversized numbers, hairline dividers */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-border border border-border rounded-lg overflow-hidden">
          {metrics.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className="bg-card p-5 lg:p-6 vn-transition hover:bg-secondary group"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {m.label}
              </p>
              {m.loading ? (
                <Skeleton className="vn-skeleton h-9 w-16 mt-3" />
              ) : (
                <p className="font-grotesk text-2xl lg:text-3xl font-bold text-foreground mt-3 tabular-nums">
                  {m.value}
                </p>
              )}
              {m.accent && (
                <span className="inline-block h-1 w-6 bg-accent mt-3" aria-hidden />
              )}
            </Link>
          ))}
        </div>

        {/* Ledger + chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <div className="flex items-baseline justify-between border-b border-border pb-4 mb-2">
              <h2 className="font-grotesk text-lg font-bold text-foreground">Recent orders</h2>
              <Link
                href="/dashboard/admin/orders/all"
                className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground vn-transition"
              >
                All orders
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em]">Product</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-[0.2em]">Buyer</TableHead>
                  <TableHead className="text-right text-[10px] uppercase tracking-[0.2em]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areRecentOrdersLoading ? (
                  <>
                    <TableRow><TableCell colSpan={3}><Skeleton className="vn-skeleton h-6 w-full" /></TableCell></TableRow>
                    <TableRow><TableCell colSpan={3}><Skeleton className="vn-skeleton h-6 w-full" /></TableCell></TableRow>
                  </>
                ) : recentOrders && recentOrders.length > 0 ? (
                  recentOrders.map((order) => <RecentSaleRow key={order.id} order={order} />)
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24 text-muted-foreground text-sm">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>

          <section>
            <div className="border-b border-border pb-4 mb-6">
              <h2 className="font-grotesk text-lg font-bold text-foreground">Revenue — last 7 days</h2>
            </div>
            <div className="h-72">
              {isChartLoading ? (
                <Skeleton className="vn-skeleton h-full w-full rounded-lg" />
              ) : (
                <ChartContainer config={chartConfig} className="w-full h-full">
                  <BarChart accessibilityLayer data={salesChartData}>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={11}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={2} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </section>
        </div>

        {/* Control links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-lg overflow-hidden">
          {[
            {
              icon: ScreenShare,
              title: 'LIVE CONTROL',
              desc: 'Monitor sessions, moderation queue and stream analytics.',
              links: [
                { label: 'Live sessions', href: '/dashboard/admin/live-shopping/sessions' },
                { label: 'Moderation queue', href: '/dashboard/admin/live-shopping/flagged' },
              ],
            },
            {
              icon: Megaphone,
              title: 'GROWTH',
              desc: 'Homepage content, ads and platform-wide announcements.',
              links: [
                { label: 'Manage homepage', href: '/dashboard/admin/marketing/sliders' },
                { label: 'Send notifications', href: '/dashboard/admin/marketing/notifications' },
              ],
            },
            {
              icon: Activity,
              title: 'SYSTEM',
              desc: 'Server status, media storage and platform health.',
              links: [
                { label: 'Server status', href: '/dashboard/admin/system/server-status' },
                { label: 'Media storage', href: '/dashboard/admin/system/media-storage' },
              ],
            },
            {
              icon: ShieldAlert,
              title: 'SAFETY',
              desc: 'Resolve disputes, complaints and flagged content.',
              links: [
                { label: 'Complaints', href: '/dashboard/admin/support/complaints' },
                { label: 'Reported products', href: '/dashboard/admin/products/reported' },
                { label: 'Seller & Buyer Issues', href: '/dashboard/admin/support/seller-buyer-issues' },
              ],
            },
          ].map((panel) => (
            <div key={panel.title} className="bg-card p-6 lg:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground inline-flex items-center gap-2.5">
                <panel.icon className="h-3.5 w-3.5" /> {panel.title}
              </p>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{panel.desc}</p>
              <div className="mt-5 flex flex-col gap-1">
                {panel.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="group flex items-center justify-between py-2 text-sm text-foreground/80 hover:text-foreground vn-transition"
                  >
                    {link.label}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 vn-transition" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
