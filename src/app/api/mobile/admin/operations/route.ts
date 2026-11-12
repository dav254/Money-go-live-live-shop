/**
 * /api/mobile/admin/operations — the native admin Operations surface.
 *
 * GET  ?section=summary|users|sellers|market|finance|safety|growth
 * PATCH { action: 'verification' | 'payout-status', ... }
 *
 * Reads are bounded and merge the VPS mirrors with Firestore where a mirror
 * exists. A store that cannot answer makes its section `available:false`; it
 * never turns into an invented zero. All mutations are narrow, validated
 * actions — this route does not execute arbitrary documents or shell work.
 */
import type { NextRequest } from 'next/server';

import { db } from '@/firebase/server';
import { adminGate, json } from '@/lib/admin-ai/http';
import { listProposals } from '@/lib/ai-headquarters/proposals';
import { REQUESTS_COLLECTION } from '@/lib/media/config';
import { pbListAllOrders } from '@/lib/pocketbase/orders';
import { pbListAllProducts } from '@/lib/pocketbase/products';
import { pbListProfilesByRole } from '@/lib/pocketbase/profiles';
import { pbPendingPayoutTotal } from '@/lib/pocketbase/wallet';
import { growthCounts, listGrowthPosts } from '@/lib/vidnov-core/growth-posts/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROFILE_LIMIT = 1000;
const PRODUCT_LIMIT = 400;
const ORDER_LIMIT = 500;
const COMPLAINT_LIMIT = 250;
const PAYOUT_LIMIT = 100;
const PAYMENT_LIMIT = 100;
const REQUEST_LIMIT = 60;
const GROWTH_LIMIT = 25;
const CAMPAIGN_LIMIT = 25;

type Section = 'summary' | 'users' | 'sellers' | 'market' | 'finance' | 'safety' | 'growth';
type Loose = Record<string, unknown>;

interface Loaded<T> {
  rows: T[];
  available: boolean;
  notice?: string;
}

export interface OpsUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  verificationStatus: string | null;
  shopName: string | null;
  joinDate: string | null;
  profilePictureUrl: string | null;
  aiPoints: number;
}

export interface OpsProduct {
  id: string;
  name: string;
  sellerId: string;
  sellerName: string | null;
  imageUrl: string | null;
  price: number;
  stock: number;
  category: string | null;
  listingType: string;
  featured: boolean;
  unpublished: boolean;
  uploadDate: string | null;
}

export interface OpsOrder {
  id: string;
  productName: string;
  totalAmount: number;
  status: string;
  orderDate: string | null;
  buyerId: string;
  buyerName: string | null;
  sellerId: string;
  sellerName: string | null;
  paymentMethod: string | null;
}

export interface OpsRequest {
  id: string;
  title: string;
  category: string;
  status: string;
  customerName: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  offersCount: number;
  reports: number;
  location: string | null;
  createdAt: string | null;
}

export interface OpsComplaint {
  id: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  details: string | null;
  status: string;
  reporterId: string | null;
  orderId: string | null;
  createdAt: string | null;
}

export interface OpsPayout {
  id: string;
  sellerId: string;
  sellerName: string | null;
  amount: number;
  status: string;
  method: string | null;
  requestedAt: string | null;
}

export interface OpsPayment {
  id: string;
  userId: string | null;
  userName: string | null;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  kind: string | null;
  createdAt: string | null;
}

export interface OpsLive {
  id: string;
  title: string;
  sellerId: string;
  sellerName: string | null;
  viewerCount: number;
  startedAt: string | null;
}

export interface OpsGrowthPost {
  id: string;
  productName: string;
  caption: string;
  status: string;
  sharePath: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OpsCampaign {
  id: string;
  sellerId: string;
  sellerName: string | null;
  budget: number;
  currency: string;
  status: string;
  createdAt: string | null;
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  const v = value as { toDate?: () => Date; toMillis?: () => number; seconds?: number };
  try {
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v.toMillis === 'function') return new Date(v.toMillis()).toISOString();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  } catch {
    return null;
  }
  return null;
}

function roleOf(value: unknown): string {
  const role = text(value, 30)?.toLowerCase();
  return role || 'buyer';
}

function statusOf(value: unknown): string {
  return text(value, 30)?.toLowerCase() || 'unknown';
}

function isProductReport(complaint: OpsComplaint): boolean {
  return complaint.targetType.toLowerCase() === 'product';
}

function countsBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

async function loadProfiles(): Promise<Loaded<OpsUser>> {
  const byId = new Map<string, OpsUser>();
  let firestoreOk = false;

  try {
    const snap = await db.collection('userProfiles').limit(PROFILE_LIMIT).get();
    firestoreOk = true;
    snap.docs.forEach((doc) => {
      const data = (doc.data() ?? {}) as Loose;
      const id = text(data.uid, 120) ?? doc.id;
      byId.set(id, {
        id,
        fullName: text(data.fullName, 160) ?? text(data.username, 80) ?? text(data.email, 200) ?? 'Unnamed account',
        email: text(data.email, 200),
        phone: text(data.phoneNumber, 60),
        role: roleOf(data.userRole ?? data.role),
        status: statusOf(data.status),
        verificationStatus: text(data.verificationStatus, 30),
        shopName: text(data.shopName, 160),
        joinDate: iso(data.joinDate) ?? iso(data.createdAt),
        profilePictureUrl: text(data.profilePictureUrl, 500) ?? text(data.photoURL, 500),
        aiPoints: number(data.aiPoints),
      });
    });
  } catch (error) {
    console.error('[admin-operations] Firestore profiles read failed', error);
  }

  let vpsOk = false;
  for (const role of ['buyer', 'seller', 'reseller', 'admin']) {
    const rows = await pbListProfilesByRole(role, 250).catch(() => null);
    if (rows === null) continue;
    vpsOk = true;
    rows.forEach((row) => {
      if (!row.uid || byId.has(row.uid)) return;
      byId.set(row.uid, {
        id: row.uid,
        fullName: row.fullName || row.username || row.email || 'Unnamed account',
        email: row.email ?? null,
        phone: row.phoneNumber ?? null,
        role: roleOf(row.userRole),
        status: statusOf(row.status),
        verificationStatus: null,
        shopName: row.shopName ?? null,
        joinDate: iso(row.joinDate),
        profilePictureUrl: row.profilePictureUrl ?? null,
        aiPoints: number(row.aiPoints),
      });
    });
  }

  const rows = [...byId.values()].sort((a, b) => {
    const aTime = a.joinDate ? Date.parse(a.joinDate) : 0;
    const bTime = b.joinDate ? Date.parse(b.joinDate) : 0;
    return bTime - aTime || a.fullName.localeCompare(b.fullName);
  });

  return {
    rows,
    available: firestoreOk || vpsOk,
    notice:
      !firestoreOk && vpsOk
        ? 'Firestore could not be read; showing the VPS copy of accounts.'
        : !firestoreOk && !vpsOk
          ? 'Accounts could not be read from either store.'
          : undefined,
  };
}

async function loadProducts(profiles: Map<string, OpsUser>): Promise<Loaded<OpsProduct>> {
  const byId = new Map<string, OpsProduct>();
  let firestoreOk = false;

  try {
    const snap = await db.collection('products').limit(PRODUCT_LIMIT).get();
    firestoreOk = true;
    snap.docs.forEach((doc) => {
      const data = (doc.data() ?? {}) as Loose;
      const sellerId = text(data.sellerId, 120) ?? '';
      byId.set(doc.id, {
        id: doc.id,
        name: text(data.name, 200) ?? 'Untitled listing',
        sellerId,
        sellerName: profiles.get(sellerId)?.shopName ?? profiles.get(sellerId)?.fullName ?? null,
        imageUrl:
          text(data.imageUrl, 500) ??
          (Array.isArray(data.imageUrls) ? text(data.imageUrls[0], 500) : null),
        price: number(data.price),
        stock: number(data.stock),
        category: text(data.category, 120),
        listingType: text(data.listingType, 30) ?? 'product',
        featured: data.featured === true,
        unpublished: data.unpublished === true,
        uploadDate: iso(data.uploadDate) ?? iso(data.createdAt),
      });
    });
  } catch (error) {
    console.error('[admin-operations] Firestore products read failed', error);
  }

  let vpsOk = false;
  const mirrored = await pbListAllProducts(PRODUCT_LIMIT).catch(() => null);
  if (mirrored !== null) {
    vpsOk = true;
    mirrored.forEach((row) => {
      if (byId.has(row.id)) return;
      const data = (row.data ?? {}) as Loose;
      const sellerId = row.sellerId ?? text(data.sellerId, 120) ?? '';
      byId.set(row.id, {
        id: row.id,
        name: row.name ?? text(data.name, 200) ?? 'Untitled listing',
        sellerId,
        sellerName: profiles.get(sellerId)?.shopName ?? profiles.get(sellerId)?.fullName ?? null,
        imageUrl:
          row.imageUrl ??
          text(data.imageUrl, 500) ??
          (Array.isArray(data.imageUrls) ? text(data.imageUrls[0], 500) : null),
        price: number(row.price ?? data.price),
        stock: number(row.stock ?? data.stock),
        category: row.category ?? text(data.category, 120),
        listingType: row.listingType ?? text(data.listingType, 30) ?? 'product',
        featured: data.featured === true,
        unpublished: data.unpublished === true,
        uploadDate: row.createdAt ?? iso(data.uploadDate) ?? iso(data.createdAt),
      });
    });
  }

  const rows = [...byId.values()].sort((a, b) => {
    const aTime = a.uploadDate ? Date.parse(a.uploadDate) : 0;
    const bTime = b.uploadDate ? Date.parse(b.uploadDate) : 0;
    return bTime - aTime;
  });

  return {
    rows,
    available: firestoreOk || vpsOk,
    notice: !firestoreOk && vpsOk ? 'Showing the VPS catalogue copy.' : undefined,
  };
}

async function loadOrders(profiles: Map<string, OpsUser>): Promise<Loaded<OpsOrder>> {
  const byId = new Map<string, OpsOrder>();
  let firestoreOk = false;

  try {
    const snap = await db.collection('orders').limit(ORDER_LIMIT).get();
    firestoreOk = true;
    snap.docs.forEach((doc) => {
      const data = (doc.data() ?? {}) as Loose;
      byId.set(doc.id, {
        id: doc.id,
        productName: text(data.productName, 200) ?? 'Order',
        totalAmount: number(data.totalAmount ?? data.productPrice),
        status: statusOf(data.orderStatus),
        orderDate: iso(data.orderDate) ?? iso(data.createdAt),
        buyerId: text(data.buyerId, 120) ?? '',
        buyerName: profiles.get(text(data.buyerId, 120) ?? '')?.fullName ?? null,
        sellerId: text(data.sellerId, 120) ?? '',
        sellerName: profiles.get(text(data.sellerId, 120) ?? '')?.shopName ?? null,
        paymentMethod: text(data.paymentMethod, 80),
      });
    });
  } catch (error) {
    console.error('[admin-operations] Firestore orders read failed', error);
  }

  let vpsOk = false;
  const mirrored = await pbListAllOrders(ORDER_LIMIT).catch(() => null);
  if (mirrored !== null) {
    vpsOk = true;
    mirrored.forEach((row) => {
      if (byId.has(row.id)) return;
      const data = (row.data ?? {}) as Loose;
      const buyerId = row.buyerId ?? text(data.buyerId, 120) ?? '';
      const sellerId = row.sellerId ?? text(data.sellerId, 120) ?? '';
      byId.set(row.id, {
        id: row.id,
        productName: text(data.productName, 200) ?? 'Order',
        totalAmount: number(row.totalAmount ?? data.totalAmount ?? data.productPrice),
        status: statusOf(row.orderStatus ?? data.orderStatus),
        orderDate: iso(data.orderDate) ?? iso(data.createdAt),
        buyerId,
        buyerName: profiles.get(buyerId)?.fullName ?? null,
        sellerId,
        sellerName: profiles.get(sellerId)?.shopName ?? null,
        paymentMethod: text(data.paymentMethod, 80),
      });
    });
  }

  const rows = [...byId.values()].sort((a, b) => {
    const aTime = a.orderDate ? Date.parse(a.orderDate) : 0;
    const bTime = b.orderDate ? Date.parse(b.orderDate) : 0;
    return bTime - aTime;
  });

  return {
    rows,
    available: firestoreOk || vpsOk,
    notice: !firestoreOk && vpsOk ? 'Showing the VPS order copy.' : undefined,
  };
}

async function loadComplaints(): Promise<Loaded<OpsComplaint>> {
  try {
    const snap = await db.collection('complaints').limit(COMPLAINT_LIMIT).get();
    const rows = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Loose;
        return {
          id: doc.id,
          targetType: text(data.targetType, 30) ?? 'other',
          targetId: text(data.targetId, 120),
          reason: text(data.reason, 160),
          details: text(data.details ?? data.description, 1200),
          status: statusOf(data.status),
          reporterId: text(data.complainantId, 120),
          orderId: text(data.orderId, 120),
          createdAt: iso(data.createdAt),
        } satisfies OpsComplaint;
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return { rows, available: true };
  } catch (error) {
    console.error('[admin-operations] complaints read failed', error);
    return { rows: [], available: false, notice: 'Complaints could not be read from Firestore.' };
  }
}

async function loadLive(profiles: Map<string, OpsUser>): Promise<Loaded<OpsLive>> {
  try {
    const snap = await db.collection('liveSessions').where('status', '==', 'live').limit(50).get();
    const rows = snap.docs.map((doc) => {
      const data = (doc.data() ?? {}) as Loose;
      const sellerId = text(data.sellerId, 120) ?? '';
      return {
        id: doc.id,
        title: text(data.title, 200) ?? 'Live stream',
        sellerId,
        sellerName: profiles.get(sellerId)?.shopName ?? profiles.get(sellerId)?.fullName ?? null,
        viewerCount: number(data.viewerCount),
        startedAt: iso(data.startTime) ?? iso(data.lastStartedAt),
      } satisfies OpsLive;
    });
    return { rows, available: true };
  } catch (error) {
    console.error('[admin-operations] live sessions read failed', error);
    return { rows: [], available: false, notice: 'Live sessions could not be read.' };
  }
}

async function loadRequests(): Promise<Loaded<OpsRequest>> {
  try {
    const snap = await db.collection(REQUESTS_COLLECTION).limit(REQUEST_LIMIT).get();
    const rows = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Loose;
        return {
          id: doc.id,
          title: text(data.title, 200) ?? 'Untitled request',
          category: text(data.category, 120) ?? 'Other',
          status: statusOf(data.status),
          customerName: text(data.customerName, 160),
          budgetMin: typeof data.budgetMin === 'number' ? data.budgetMin : null,
          budgetMax: typeof data.budgetMax === 'number' ? data.budgetMax : null,
          currency: text(data.currency, 10)?.toUpperCase() ?? 'USD',
          offersCount: number(data.offersCount),
          reports: Array.isArray(data.reports) ? data.reports.length : 0,
          location: text(data.location, 160),
          createdAt: iso(data.createdAt),
        } satisfies OpsRequest;
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return { rows, available: true };
  } catch (error) {
    console.error('[admin-operations] requests read failed', error);
    return { rows: [], available: false, notice: 'Buyer requests could not be read.' };
  }
}

async function loadPayouts(profiles: Map<string, OpsUser>): Promise<Loaded<OpsPayout>> {
  try {
    const snap = await db.collection('payouts').limit(PAYOUT_LIMIT).get();
    const rows = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Loose;
        const sellerId = text(data.sellerId, 120) ?? '';
        return {
          id: doc.id,
          sellerId,
          sellerName: profiles.get(sellerId)?.shopName ?? profiles.get(sellerId)?.fullName ?? null,
          amount: number(data.amount),
          status: statusOf(data.status),
          method: text(data.payoutMethodInfo, 160),
          requestedAt: iso(data.requestedAt) ?? iso(data.createdAt),
        } satisfies OpsPayout;
      })
      .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
    return { rows, available: true };
  } catch (error) {
    console.error('[admin-operations] payouts read failed', error);
    return { rows: [], available: false, notice: 'Payout records could not be read from Firestore.' };
  }
}

async function loadPayments(profiles: Map<string, OpsUser>): Promise<Loaded<OpsPayment>> {
  try {
    const snap = await db.collection('payments').limit(PAYMENT_LIMIT).get();
    const rows = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Loose;
        const userId = text(data.userId, 120);
        return {
          id: doc.id,
          userId,
          userName: userId ? profiles.get(userId)?.fullName ?? null : null,
          orderId: text(data.orderId, 120),
          amount: number(data.amount),
          currency: text(data.currency, 10)?.toUpperCase() ?? 'USD',
          status: statusOf(data.status ?? data.paymentStatus),
          method: text(data.method ?? data.paymentMethod, 80),
          kind: text(data.transactionType, 80),
          createdAt: iso(data.createdAt) ?? iso(data.paymentDate),
        } satisfies OpsPayment;
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return { rows, available: true };
  } catch (error) {
    console.error('[admin-operations] payments read failed', error);
    return { rows: [], available: false, notice: 'Payments could not be read from Firestore.' };
  }
}

async function loadGrowth(profiles: Map<string, OpsUser>): Promise<{
  posts: OpsGrowthPost[];
  campaigns: OpsCampaign[];
  counts: Record<string, number>;
  available: boolean;
  notice?: string;
}> {
  let posts: OpsGrowthPost[] = [];
  let counts: Record<string, number> = {};
  let available = false;

  try {
    const [rows, growth] = await Promise.all([
      listGrowthPosts(db, { limit: GROWTH_LIMIT }),
      growthCounts(db),
    ]);
    counts = growth;
    posts = rows.map((post) => ({
      id: post.id,
      productName: post.productName,
      caption: post.caption,
      status: post.status,
      sharePath: post.sharePath,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));
    available = true;
  } catch (error) {
    console.error('[admin-operations] growth posts read failed', error);
  }

  let campaigns: OpsCampaign[] = [];
  try {
    const snap = await db.collection('boost_requests').limit(CAMPAIGN_LIMIT).get();
    campaigns = snap.docs
      .map((doc) => {
        const data = (doc.data() ?? {}) as Loose;
        const sellerId = text(data.sellerId, 120) ?? '';
        return {
          id: doc.id,
          sellerId,
          sellerName: profiles.get(sellerId)?.shopName ?? profiles.get(sellerId)?.fullName ?? null,
          budget: number(data.budget),
          currency: text(data.currency, 10)?.toUpperCase() ?? 'USD',
          status: statusOf(data.status),
          createdAt: iso(data.createdAt),
        } satisfies OpsCampaign;
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    available = available || campaigns.length > 0;
  } catch (error) {
    console.error('[admin-operations] campaigns read failed', error);
  }

  return {
    posts,
    campaigns,
    counts,
    available,
    notice: available ? undefined : 'Growth posts and campaigns could not be read.',
  };
}

function profileMap(profiles: OpsUser[]): Map<string, OpsUser> {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

function profileCounts(users: OpsUser[]) {
  return {
    total: users.length,
    buyers: users.filter((user) => user.role === 'buyer').length,
    sellers: users.filter((user) => user.role === 'seller').length,
    resellers: users.filter((user) => user.role === 'reseller').length,
    admins: users.filter((user) => user.role === 'admin').length,
    suspended: users.filter((user) => user.status === 'suspended').length,
    pendingVerification: users.filter((user) => user.verificationStatus === 'pending').length,
  };
}

function orderFigures(orders: OpsOrder[]) {
  const activeStatuses = ['pending', 'paid', 'processing', 'packed', 'shipped', 'delivery', 'disputed'];
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let gmv = 0;
  let revenue7d = 0;
  let revenueToday = 0;
  let open = 0;
  let delivered = 0;
  let disputed = 0;

  for (const order of orders) {
    const status = order.status;
    if (status !== 'cancelled' && status !== 'refunded') gmv += order.totalAmount;
    if (activeStatuses.includes(status)) open += 1;
    if (status === 'delivered') delivered += 1;
    if (status === 'disputed') disputed += 1;
    const at = order.orderDate ? Date.parse(order.orderDate) : 0;
    if (at >= weekAgo && status !== 'cancelled' && status !== 'refunded') revenue7d += order.totalAmount;
    if (at >= today.getTime() && status !== 'cancelled' && status !== 'refunded') revenueToday += order.totalAmount;
  }

  return { total: orders.length, open, delivered, disputed, gmv, revenue7d, revenueToday };
}

function complaintFigures(complaints: OpsComplaint[]) {
  return {
    total: complaints.length,
    open: complaints.filter((complaint) => complaint.status === 'open').length,
    investigating: complaints.filter((complaint) => complaint.status === 'investigating').length,
    resolved: complaints.filter((complaint) => complaint.status === 'resolved').length,
    dismissed: complaints.filter((complaint) => complaint.status === 'dismissed').length,
  };
}

function payoutFigures(payouts: OpsPayout[], fallbackPendingTotal: number | null) {
  const pending = payouts.filter((payout) => payout.status === 'pending');
  const pendingTotal = pending.reduce((sum, payout) => sum + payout.amount, 0);
  return {
    total: payouts.length,
    pending: pending.length,
    processing: payouts.filter((payout) => payout.status === 'processing').length,
    completed: payouts.filter((payout) => payout.status === 'completed').length,
    failed: payouts.filter((payout) => payout.status === 'failed').length,
    pendingTotal: pending.length > 0 ? pendingTotal : fallbackPendingTotal ?? 0,
  };
}

function growthFigures(counts: Record<string, number>) {
  return {
    draft: counts.draft ?? 0,
    approved: counts.approved ?? 0,
    rejected: counts.rejected ?? 0,
    published:
      (counts.published ?? 0) + (counts.partially_published ?? 0),
    failed: counts.failed ?? 0,
    unknown: counts.unknown ?? 0,
  };
}

async function pendingApprovals(): Promise<{ pending: number; available: boolean }> {
  try {
    const proposals = await listProposals(db, { limit: 50 });
    return {
      pending: proposals.filter((proposal) => proposal.status === 'pending').length,
      available: true,
    };
  } catch (error) {
    console.error('[admin-operations] approvals read failed', error);
    return { pending: 0, available: false };
  }
}

export async function GET(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  const requested = request.nextUrl.searchParams.get('section') ?? 'summary';
  const allowed: Section[] = ['summary', 'users', 'sellers', 'market', 'finance', 'safety', 'growth'];
  const section = (allowed.includes(requested as Section) ? requested : 'summary') as Section;
  const generatedAt = new Date().toISOString();

  if (section === 'users') {
    const profiles = await loadProfiles();
    return json({
      generatedAt,
      section,
      available: profiles.available,
      notice: profiles.notice ?? null,
      users: profiles.rows,
      counts: profileCounts(profiles.rows),
    });
  }

  if (section === 'sellers') {
    const [profiles, products, orders, live] = await Promise.all([
      loadProfiles(),
      loadProducts(new Map()),
      loadOrders(new Map()),
      loadLive(new Map()),
    ]);
    const map = profileMap(profiles.rows);
    const sellers = profiles.rows
      .filter((profile) => profile.role === 'seller')
      .map((profile) => {
        const sellerProducts = products.rows.filter((product) => product.sellerId === profile.id);
        const sellerOrders = orders.rows.filter((order) => order.sellerId === profile.id);
        return {
          ...profile,
          productCount: sellerProducts.length,
          orderCount: sellerOrders.length,
          gmv: sellerOrders
            .filter((order) => order.status !== 'cancelled' && order.status !== 'refunded')
            .reduce((sum, order) => sum + order.totalAmount, 0),
          live: live.rows.some((session) => session.sellerId === profile.id),
        };
      })
      .sort((a, b) => b.gmv - a.gmv || a.fullName.localeCompare(b.fullName));

    return json({
      generatedAt,
      section,
      available: profiles.available,
      notice: profiles.notice ?? products.notice ?? null,
      sellers,
      counts: {
        ...profileCounts(profiles.rows),
        verified: sellers.filter((seller) => seller.verificationStatus === 'verified').length,
        pending: sellers.filter((seller) => seller.verificationStatus === 'pending').length,
        live: sellers.filter((seller) => seller.live).length,
      },
    });
  }

  if (section === 'market') {
    const profiles = await loadProfiles();
    const map = profileMap(profiles.rows);
    const [products, orders, requests, live, complaints] = await Promise.all([
      loadProducts(map),
      loadOrders(map),
      loadRequests(),
      loadLive(map),
      loadComplaints(),
    ]);

    return json({
      generatedAt,
      section,
      available: {
        profiles: profiles.available,
        products: products.available,
        orders: orders.available,
        requests: requests.available,
        live: live.available,
        complaints: complaints.available,
      },
      notices: [profiles.notice, products.notice, orders.notice, requests.notice].filter(Boolean),
      products: products.rows,
      orders: orders.rows,
      requests: requests.rows,
      live: live.rows,
      counts: {
        products: products.rows.length,
        productsReported: complaints.rows.filter(isProductReport).length,
        unpublished: products.rows.filter((product) => product.unpublished).length,
        featured: products.rows.filter((product) => product.featured).length,
        orders: orders.rows.length,
        requests: requests.rows.length,
        live: live.rows.length,
        ...orderFigures(orders.rows),
      },
    });
  }

  if (section === 'finance') {
    const profiles = await loadProfiles();
    const map = profileMap(profiles.rows);
    const [orders, payouts, payments, pendingTotal] = await Promise.all([
      loadOrders(map),
      loadPayouts(map),
      loadPayments(map),
      pbPendingPayoutTotal().catch(() => null),
    ]);

    return json({
      generatedAt,
      section,
      available: {
        profiles: profiles.available,
        orders: orders.available,
        payouts: payouts.available,
        payments: payments.available,
      },
      notices: [orders.notice, payouts.notice, payments.notice].filter(Boolean),
      orders: orderFigures(orders.rows),
      payouts: payoutFigures(payouts.rows, pendingTotal),
      payoutRows: payouts.rows,
      paymentRows: payments.rows,
      currency: 'USD',
    });
  }

  if (section === 'safety') {
    const [profiles, complaints, products] = await Promise.all([
      loadProfiles(),
      loadComplaints(),
      loadProducts(new Map()),
    ]);
    const map = profileMap(profiles.rows);
    const rows = complaints.rows.map((complaint) => ({
      ...complaint,
      reporterName: complaint.reporterId ? map.get(complaint.reporterId)?.fullName ?? null : null,
      targetName:
        complaint.targetType === 'product'
          ? products.rows.find((product) => product.id === complaint.targetId)?.name ?? null
          : complaint.targetId
            ? map.get(complaint.targetId)?.fullName ?? null
            : null,
    }));

    return json({
      generatedAt,
      section,
      available: complaints.available,
      notice: complaints.notice ?? null,
      complaints: rows,
      counts: complaintFigures(rows),
    });
  }

  if (section === 'growth') {
    const profiles = await loadProfiles();
    const growth = await loadGrowth(profileMap(profiles.rows));
    return json({
      generatedAt,
      section,
      available: growth.available,
      notice: growth.notice ?? null,
      posts: growth.posts,
      campaigns: growth.campaigns,
      counts: growthFigures(growth.counts),
      campaignCounts: countsBy(growth.campaigns.map((campaign) => campaign.status as string)),
    });
  }

  const profiles = await loadProfiles();
  const map = profileMap(profiles.rows);
  const [products, orders, complaints, live, payouts, approvals, growth, pendingTotal] = await Promise.all([
    loadProducts(map),
    loadOrders(map),
    loadComplaints(),
    loadLive(map),
    loadPayouts(map),
    pendingApprovals(),
    loadGrowth(map),
    pbPendingPayoutTotal().catch(() => null),
  ]);

  return json({
    generatedAt,
    section: 'summary',
    available: {
      profiles: profiles.available,
      products: products.available,
      orders: orders.available,
      complaints: complaints.available,
      live: live.available,
      payouts: payouts.available,
      growth: growth.available,
    },
    notices: [profiles.notice, products.notice, orders.notice, complaints.notice, payouts.notice, growth.notice].filter(Boolean),
    users: profileCounts(profiles.rows),
    products: {
      total: products.rows.length,
      reported: complaints.rows.filter(isProductReport).length,
      unpublished: products.rows.filter((product) => product.unpublished).length,
      featured: products.rows.filter((product) => product.featured).length,
    },
    orders: orderFigures(orders.rows),
    finance: payoutFigures(payouts.rows, pendingTotal),
    safety: complaintFigures(complaints.rows),
    live: { active: live.rows.length },
    growth: growthFigures(growth.counts),
    approvals,
  });
}

// Narrow, audited mutations. Everything else stays read-only here.
export async function PATCH(request: NextRequest) {
  const gate = await adminGate(request);
  if (gate.response) return gate.response;

  let body: Loose;
  try {
    body = (await request.json()) as Loose;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const action = text(body.action, 40);
  if (action === 'verification') {
    const uid = text(body.uid, 120);
    const status = text(body.status, 30);
    if (!uid || !status || !['pending', 'verified', 'rejected'].includes(status)) {
      return json({ error: 'uid and a verification status of pending|verified|rejected are required.' }, 400);
    }
    try {
      await db.collection('userProfiles').doc(uid).update({ verificationStatus: status });
    } catch (error) {
      console.error('[admin-operations] verification update failed', error);
      return json({ error: 'The verification status could not be written.' }, 500);
    }
    return json({ ok: true, uid, status });
  }

  if (action === 'payout-status') {
    const id = text(body.id, 120);
    const status = text(body.status, 30);
    if (!id || !status || !['processing', 'completed', 'failed'].includes(status)) {
      return json({ error: 'id and a payout status of processing|completed|failed are required.' }, 400);
    }
    try {
      await db.collection('payouts').doc(id).update({
        status,
        ...(status === 'completed' ? { processedAt: new Date().toISOString() } : {}),
      });
    } catch (error) {
      console.error('[admin-operations] payout update failed', error);
      return json({ error: 'The payout status could not be written.' }, 500);
    }
    return json({ ok: true, id, status });
  }

  return json({ error: 'Unknown action.' }, 400);
}
