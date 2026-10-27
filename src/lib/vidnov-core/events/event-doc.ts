/**
 * CORE EVENTS — pure document builder.
 *
 * Wraps the EXISTING Growth Engine spine (`src/lib/growth/events` +
 * `growth/server`): same dedup id scheme, same day bucket, same viewer-hash
 * helper for dedupe keys, same 30-day `expiresAt` TTL contract. This module
 * only adds the engine's event vocabulary and the observational-vs-verified
 * distinction.
 *
 * `origin` is the trust boundary:
 *   • 'server'              — written by trusted services after a verified
 *                             outcome (job succeeded, task approved, order
 *                             confirmed). May feed verified metrics.
 *   • 'client_observation'  — an observation. NEVER proof of a sale, a
 *                             completed task or a payable reward.
 *
 * Pure module: no Firestore, no I/O.
 */

import { dedupeDocId, eventDayKey, eventExpiresAt } from '../../growth/events';
import { hashViewerId } from '../../growth/server';
import type { Attribution, CoreEventType, EventEntityKind, EventOrigin } from '../types';

export const CORE_EVENTS_COLLECTION = 'contentEvents';

export interface CoreEventInput {
  type: CoreEventType;
  entityKind: EventEntityKind;
  entityId: string;
  origin: EventOrigin;
  /** Authenticated actor, when there is one. Server-verified uids only. */
  actorUid?: string;
  attribution?: Attribution;
  /**
   * Deterministic key: the same key ⇒ the same document id ⇒ exactly one
   * recorded event no matter how often the caller retries (idempotency).
   * Omit for intentionally countable occurrences.
   */
  dedupeKey?: string;
}

/**
 * Deterministic id for idempotent events, or `null` when the event should be
 * appended freely (each occurrence gets its own document).
 */
export function coreEventDocId(input: CoreEventInput, now: Date = new Date()): string | null {
  if (!input.dedupeKey) return null;
  const day = eventDayKey(now);
  return dedupeDocId(input.type, input.entityKind, input.entityId, day, hashViewerId(input.dedupeKey, day));
}

/**
 * Builds the stored event document (minus `createdAt`, which the recorder
 * sets with a server timestamp). Attribution is copied only from validated
 * fields — there is no slot for counters, prices or order values.
 */
export function buildCoreEventDoc(input: CoreEventInput, now: Date = new Date()): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    type: input.type,
    entityKind: input.entityKind,
    entityId: input.entityId,
    origin: input.origin,
    engine: 'core',
    expiresAt: eventExpiresAt(now),
  };
  if (input.actorUid) doc.actorUid = input.actorUid;
  if (input.attribution && (input.attribution.ref || input.attribution.channel || input.attribution.campaign)) {
    doc.attribution = input.attribution;
  }
  return doc;
}
