'use client';

import type { User } from 'firebase/auth';
import type { MarketplaceOffer, MarketplaceRequest, CreateRequestInput } from './types';
import type { MediaSummary } from '@/lib/media/service';

export type { MediaSummary };

/** Offer as returned by the API — includes resolved attachment summaries. */
export interface OfferWithMedia extends MarketplaceOffer {
  media?: MediaSummary[];
}

/**
 * Request Marketplace client — every call goes through the same authed
 * API layer (Bearer ID token). UI never talks to Firestore collections
 * for requests/offers directly: privacy rules live server-side (§32).
 */

async function authHeaders(user: User): Promise<Record<string, string>> {
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body as T;
}

/** Requests I posted — identical for buyers and sellers. */
export async function fetchMyRequests(user: User): Promise<MarketplaceRequest[]> {
  const res = await fetch('/api/requests?scope=mine', { headers: await authHeaders(user) });
  const data = await parse<{ requests: MarketplaceRequest[] }>(res);
  return data.requests;
}

/**
 * Open requests any seller can still bid on ("Open for Business").
 * A request disappears from here the moment the customer accepts an offer.
 */
export async function fetchOpenRequests(user: User): Promise<MarketplaceRequest[]> {
  const res = await fetch('/api/requests?scope=open', { headers: await authHeaders(user) });
  const data = await parse<{ requests: MarketplaceRequest[] }>(res);
  return data.requests;
}

/** Requests this seller WON (their offer was accepted) — still actionable. */
export async function fetchMyWonRequests(user: User): Promise<MarketplaceRequest[]> {
  const res = await fetch('/api/requests?scope=won', { headers: await authHeaders(user) });
  const data = await parse<{ requests: MarketplaceRequest[] }>(res);
  return data.requests;
}

export async function fetchRequestDetail(
  user: User,
  id: string,
): Promise<{ request: MarketplaceRequest; mediaAuthorized: boolean; media: MediaSummary[] }> {
  const res = await fetch(`/api/requests?id=${encodeURIComponent(id)}`, {
    headers: await authHeaders(user),
  });
  return parse<{ request: MarketplaceRequest; mediaAuthorized: boolean; media: MediaSummary[] }>(res);
}

export async function createRequest(
  user: User,
  input: CreateRequestInput,
): Promise<MarketplaceRequest> {
  const res = await fetch('/api/requests', {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify(input),
  });
  const data = await parse<{ request: MarketplaceRequest }>(res);
  return data.request;
}

export async function requestAction(
  user: User,
  action: 'close' | 'delete' | 'accept' | 'my-offer' | 'edit' | 'renew' | 'decline' | 'report',
  requestId: string,
  payload?: Record<string, unknown>,
): Promise<{ ok?: boolean; offer?: MarketplaceOffer | null; orderId?: string }> {
  const res = await fetch(
    `/api/requests?action=${action}&id=${encodeURIComponent(requestId)}`,
    {
      method: 'PATCH',
      headers: await authHeaders(user),
      body: JSON.stringify(payload ?? {}),
    },
  );
  return parse(res);
}

export async function incrementRequestView(user: User, requestId: string): Promise<void> {
  await fetch(`/api/requests?id=${encodeURIComponent(requestId)}`, {
    method: 'PUT',
    headers: await authHeaders(user),
  }).catch(() => undefined);
}

export async function fetchOffersForRequest(
  user: User,
  requestId: string,
): Promise<OfferWithMedia[]> {
  const res = await fetch(`/api/requests/offers?requestId=${encodeURIComponent(requestId)}`, {
    headers: await authHeaders(user),
  });
  const data = await parse<{ offers: OfferWithMedia[] }>(res);
  return data.offers;
}

export async function fetchMyOffers(user: User): Promise<OfferWithMedia[]> {
  const res = await fetch('/api/requests/offers?mine=1', { headers: await authHeaders(user) });
  const data = await parse<{ offers: OfferWithMedia[] }>(res);
  return data.offers;
}

/** Reserves (or returns) the seller's draft offer for a request. */
export async function createOfferDraft(
  user: User,
  requestId: string,
): Promise<MarketplaceOffer> {
  const res = await fetch('/api/requests/offers', {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify({ requestId }),
  });
  const data = await parse<{ offer: MarketplaceOffer }>(res);
  return data.offer;
}

export async function submitOffer(
  user: User,
  offerId: string,
  input: { price: number; message: string; deliveryDays?: number | null; mediaIds?: string[] },
): Promise<MarketplaceOffer> {
  // `id` in the PATCH query is the offer id for action=offer.
  const res = await fetch(
    `/api/requests?action=offer&id=${encodeURIComponent(offerId)}`,
    {
      method: 'PATCH',
      headers: await authHeaders(user),
      body: JSON.stringify(input),
    },
  );
  const data = await parse<{ offer: MarketplaceOffer }>(res);
  return data.offer;
}

export async function withdrawOffer(user: User, offerId: string): Promise<void> {
  await fetch(`/api/requests/offers?id=${encodeURIComponent(offerId)}&action=withdraw`, {
    method: 'PATCH',
    headers: await authHeaders(user),
  }).catch(() => undefined);
}

/** Private media URL — always proxied through the authorization-checked route. */
export function privateMediaUrl(mediaId: string, thumb = false): string {
  return `/api/media/serve/${mediaId}${thumb ? '?thumb=1' : ''}`;
}
