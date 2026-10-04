/**
 * AVAILABILITY — the thing that makes "nearby" useful.
 *
 * ## One model, two vocabularies
 *
 * A shop sells things and a plumber sells time, so the spec listed two sets of
 * states. They are the same question — "can I get this today?" — asked about
 * two different kinds of thing, so they share one type rather than becoming two
 * unrelated enums that drift apart on the first fix.
 *
 *   goods:    available · low_stock · out_of_stock · preorder · on_request
 *   services: available_today · available_tomorrow · fully_booked
 *             · accepting_requests
 *
 * ## What it decides
 *
 * Only `canBuyNow` gates the buy button. Everything else is information: a
 * preorder is sellable, a fully booked plumber is still worth showing. Making
 * "out of stock" hide a listing would be a worse marketplace than one that
 * shows it and says so.
 */

import type { AvailabilityState } from './types';

export const GOODS_STATES: AvailabilityState[] = [
  'available',
  'low_stock',
  'out_of_stock',
  'preorder',
  'on_request',
];

export const SERVICE_STATES: AvailabilityState[] = [
  'available_today',
  'available_tomorrow',
  'fully_booked',
  'accepting_requests',
];

const LABELS: Record<AvailabilityState, string> = {
  available: 'Available',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
  preorder: 'Pre-order',
  on_request: 'Available on request',
  available_today: 'Available today',
  available_tomorrow: 'Available tomorrow',
  fully_booked: 'Fully booked',
  accepting_requests: 'Accepting requests',
};

const DESCRIPTIONS: Record<AvailabilityState, string> = {
  available: 'Ready now',
  low_stock: 'Only a few left',
  out_of_stock: 'Back soon — check back later',
  preorder: 'Order now, ships when restocked',
  on_request: 'Ask the seller and they will confirm',
  available_today: 'Free to start today',
  available_tomorrow: 'Free from tomorrow',
  fully_booked: 'No slots left — join the waitlist',
  accepting_requests: 'Send a request and they will quote you',
};

export function availabilityLabel(state: AvailabilityState | null | undefined): string {
  return (state && LABELS[state]) || 'Available';
}

export function availabilityDescription(state: AvailabilityState | null | undefined): string {
  return (state && DESCRIPTIONS[state]) || 'Ready now';
}

/**
 * Can this be bought or booked right now?
 *
 * The distinction that matters: `out_of_stock` and `fully_booked` are NOT
 * buyable, but `preorder` and `on_request` ARE. A buyer can still transact with
 * a seller who has nothing in stock — they just need to agree a time. Hiding
 * those listings would be throwing away the exact buyer who wants to wait.
 *
 * Unknown or missing state means available: a listing written before
 * availability existed must not appear closed.
 */
export function canBuyNow(state: AvailabilityState | null | undefined): boolean {
  if (!state) return true;
  return state !== 'out_of_stock' && state !== 'fully_booked';
}

/** Is it worth showing a buyer at all? Everything is; that is the point. */
export function isVisibleInDiscovery(state: AvailabilityState | null | undefined): boolean {
  return true;
}

/**
 * Should this be offered in response to a request?
 *
 * `on_request` / `accepting_requests` is the seller saying "yes, come to me".
 * A fully booked one is not offered — routing a request to a plumber who has
 * said they are full is worse than showing fewer matches.
 */
export function acceptsRequests(state: AvailabilityState | null | undefined): boolean {
  if (!state) return true;
  return state !== 'out_of_stock' && state !== 'fully_booked';
}

/** The states that make sense for a listing of this kind. */
export function statesFor(kind: 'product' | 'service'): AvailabilityState[] {
  return kind === 'service' ? SERVICE_STATES : GOODS_STATES;
}

export function isStateFor(kind: 'product' | 'service', state: AvailabilityState): boolean {
  return statesFor(kind).includes(state);
}

/**
 * Coerces whatever is stored into a state we know how to render.
 *
 * Unknown values fall through to `available` rather than rendering a blank
 * badge, because an unrecognised string must never make a listing look closed.
 */
export function coerceAvailabilityState(value: unknown): AvailabilityState | null {
  const all: AvailabilityState[] = [...GOODS_STATES, ...SERVICE_STATES];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as AvailabilityState)
    : null;
}
