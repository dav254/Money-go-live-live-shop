/**
 * VIDNOV LIVE — domain models (LiveKit-backed realtime streaming).
 *
 * LiveKit is infrastructure: it carries audio/video between seller and
 * viewers. Vidnov owns identity, streams, chat, commerce and moderation.
 * The LiveKit URL/secret live ONLY in server code.
 */

export type LiveStreamStatus =
  | 'DRAFT'
  | 'STARTING'
  | 'LIVE'
  | 'ENDED'
  | 'CANCELLED'
  | 'FAILED';

export type LiveVisibility = 'PUBLIC' | 'FOLLOWERS' | 'CUSTOMERS' | 'PRIVATE';

/** Firestore collection for live streams. */
export const LIVESTREAMS_COLLECTION = 'liveStreams';

export interface LiveStream {
  id: string;
  sellerId: string;
  businessId?: string | null;
  /** Unique LiveKit room, e.g. vidnov_live_83920 — never reused. */
  roomName: string;
  title: string;
  description?: string;
  categoryId?: string | null;
  /** Business-facing label (uses the product category vocabulary). */
  category?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  thumbnailMediaId?: string | null;
  visibility: LiveVisibility;
  status: LiveStreamStatus;

  /** Commerce hooks — existing Vidnov systems, never duplicated. */
  attachedProductIds: string[];
  attachedServiceIds: string[];

  viewerCount: number;
  peakViewers: number;
  /** Incremented each time a viewer joins (for total-reach analytics). */
  totalJoins: number;
  /** Sum of viewer watch time in seconds (updated on leave). */
  watchTimeSeconds: number;

  chatMessagesCount: number;
  ordersGenerated: number;
  bookingsGenerated: number;
  followersGained: number;
  reportsCount: number;

  startedAt?: unknown;
  endedAt?: unknown;
  durationSeconds?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LiveChatMessage {
  id: string;
  liveStreamId: string;
  userId: string;
  userName?: string;
  /** 'text' | reaction emoji — reactions are single-grapheme strings. */
  kind: 'text' | 'reaction';
  message: string;
  isSeller?: boolean;
  createdAt?: unknown;
}

/** Shape returned by the API to a broadcaster. */
export interface LiveBroadcasterSession {
  stream: LiveStream;
  /** wss://... LiveKit URL — safe for the browser. */
  wsUrl: string;
  /** Short-lived broadcaster token (publish + subscribe). */
  token: string;
}

/** Shape returned by the API to a viewer. */
export interface LiveViewerSession {
  stream: LiveStream;
  wsUrl: string;
  /** Short-lived viewer token (subscribe-only). */
  token: string;
}

/** Public card for discovery grids. */
export interface LiveCardView {
  id: string;
  title: string;
  status: LiveStreamStatus;
  thumbnailUrl?: string | null;
  businessName?: string | null;
  sellerName?: string | null;
  category?: string | null;
  location?: string | null;
  viewerCount: number;
  startedAt?: unknown;
  /**
   * Card is backed by a `liveSessions/{sellerId}` document (the seller
   * studio's go-live path) rather than a `liveStreams/{id}` document. The
   * id of such a card IS the seller id, and its watch page is
   * `/buyer/live/[sellerId]` — not `/live/[id]`, which only understands
   * `liveStreams` records.
   */
  sessionBacked?: boolean;
}

/** Report reasons (moderation). */
export const LIVE_REPORT_REASONS = [
  'Spam',
  'Fraud concern',
  'Prohibited content',
  'Harassment',
  'Misleading information',
  'Other',
] as const;

export type LiveReportReason = (typeof LIVE_REPORT_REASONS)[number];
