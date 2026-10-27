/**
 * ATTRIBUTION — tracked-link helpers.
 *
 * Reuses the EXISTING referral code format: `withShareRef` from the Growth
 * Engine appends `?ref=<code>` using the exact parameter name and code shape
 * `lib/referrals` already parses, so distribution links, share buttons and
 * invite links all feed one code directory and one arrival-capture path
 * (`POST /api/events` already normalises `ref` on arrival).
 *
 * This module only ADDS two optional, validated parameters for the engine:
 *   • `ch`  — distribution channel id (`google` | `meta` | `tiktok`)
 *   • `camp`— campaign id assigned when the tracked link was created
 *
 * Nothing here is trusted from a client: these helpers BUILD links on the
 * server (or in trusted UI). Reading them back is done by existing capture
 * code, and a `ch`/`camp` value can never by itself trigger a reward.
 *
 * Pure module: no I/O.
 */

import { withShareRef } from '../../growth/events';
import type { Attribution, ChannelId } from '../types';
import { CHANNEL_IDS } from '../types';

export const CHANNEL_PARAM = 'ch';
export const CAMPAIGN_PARAM = 'camp';

export interface TrackedUrlOptions {
  ref?: string | null;
  channel?: ChannelId;
  campaign?: string | null;
}

/**
 * Builds a same-site tracked path: `/products/x?ref=code&ch=google&camp=...`.
 * Never stacks a duplicate `ref` (withShareRef guards it) and never overwrites
 * parameters the path already carries.
 */
export function buildTrackedUrl(path: string, options: TrackedUrlOptions = {}): string {
  if (!path.startsWith('/')) return path; // only same-site paths are tracked
  if (/[?&](ref|ch|camp)=/.test(path)) return path; // already tracked — do not restack

  let out = withShareRef(path, options.ref ?? null);
  const extra: string[] = [];
  if (options.channel && (CHANNEL_IDS as readonly string[]).includes(options.channel)) {
    extra.push(`${CHANNEL_PARAM}=${encodeURIComponent(options.channel)}`);
  }
  const campaign = (options.campaign ?? '').trim();
  if (campaign && /^[A-Za-z0-9_-]{1,64}$/.test(campaign)) {
    extra.push(`${CAMPAIGN_PARAM}=${encodeURIComponent(campaign)}`);
  }
  if (extra.length === 0) return out;
  return `${out}${out.includes('?') ? '&' : '?'}${extra.join('&')}`;
}

export interface ParsedAttribution extends Attribution {
  /** True when at least one recognised attribution parameter was present. */
  present: boolean;
}

/**
 * Reads validated attribution parameters from an arrival URL. Unknown or
 * malformed values become `null` — never echoed raw. (The existing growth
 * arrival path already handles `ref`; this gives the engine one place to read
 * `ch`/`camp` when wiring deeper attribution later.)
 */
export function parseTrackedParams(params: URLSearchParams): ParsedAttribution {
  const ref = (params.get('ref') ?? '').trim().toLowerCase();
  const chRaw = (params.get(CHANNEL_PARAM) ?? '').trim().toLowerCase();
  const campRaw = (params.get(CAMPAIGN_PARAM) ?? '').trim();

  const channel = (CHANNEL_IDS as readonly string[]).includes(chRaw) ? (chRaw as ChannelId) : null;
  const campaign = /^[A-Za-z0-9_-]{1,64}$/.test(campRaw) ? campRaw : null;
  const refOk = ref && /^[a-z0-9-]{1,40}$/.test(ref) ? ref : null;

  return {
    present: Boolean(refOk || channel || campaign),
    ...(refOk ? { ref: refOk } : {}),
    ...(channel ? { channel } : {}),
    ...(campaign ? { campaign } : {}),
  };
}
