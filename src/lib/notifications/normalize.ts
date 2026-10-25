/**
 * NOTIFICATION NORMALIZATION — pure, dependency-free, unit-testable.
 *
 * The `notifications` collection has been written by three generations of
 * code, and the inbox must read all of them as one:
 *
 *   • Cloud Functions / legacy actions → `status: 'unread' | 'read'` + `timestamp`
 *   • `lib/notifications/engine.ts`    → `isRead: boolean` + `createdAt`
 *   • PocketBase (VPS) records         → `isRead: boolean` + `createdAt`/`created`
 *
 * Everything the API routes hand to the client is already collapsed into the
 * shape below, so no screen ever has to guess which generation it is looking
 * at again — and the client stops importing Firebase just to count unread.
 */

export interface NormalizedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  category: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  isRead: boolean;
  /** ISO-8601 string, or null when the source carried no usable timestamp. */
  createdAt: string | null;
}

/** Raw record from any generation (Firestore doc or PocketBase record). */
export type RawNotification = Record<string, unknown> & { id?: string };

/** Firestore Timestamp-like values the writers actually produce. */
function timestampToMillis(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    const v = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
    if (typeof v.toMillis === 'function') {
      const ms = v.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof v.toDate === 'function') {
      try {
        return v.toDate().getTime();
      } catch {
        return null;
      }
    }
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  return null;
}

/** Any timestamp-ish value → ISO-8601 string, or null. */
export function toIso(value: unknown): string | null {
  const ms = timestampToMillis(value);
  return ms == null ? null : new Date(ms).toISOString();
}

/**
 * Single unread predicate across both legacy field shapes.
 * A record with neither field defaults to unread — a notification that might
 * be unseen must count as unseen rather than silently vanish from the badge.
 */
export function isUnreadRecord(raw: RawNotification): boolean {
  if (typeof raw.isRead === 'boolean') return !raw.isRead;
  if (typeof raw.status === 'string') return raw.status !== 'read';
  return true;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Collapse any generation of record into the API's single shape. */
export function normalizeNotification(raw: RawNotification): NormalizedNotification {
  const createdAt = toIso(raw.createdAt ?? raw.timestamp ?? raw.created);
  const entityType = str(raw.entityType);
  const entityId = str(raw.entityId);
  const link = str(raw.link);
  return {
    id: str(raw.id),
    type: str(raw.type) || 'SYSTEM',
    title: str(raw.title) || 'Notification',
    message: str(raw.message),
    category: str(raw.category) || 'system',
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(link ? { link } : {}),
    isRead: !isUnreadRecord(raw),
    createdAt,
  };
}

/**
 * Duplicate-suppression key for one event.
 *
 * Two writes of the same event (a webhook racing its own retry, a trigger
 * firing twice) must land once. Identity is the recipient plus the event
 * (`type`) plus what it is about (`entityId`); when the event has no entity
 * the title carries that role — e.g. an admin broadcast with no link.
 */
export function dedupeIdentity(input: {
  userId: string;
  type: string;
  entityId?: string;
  title?: string;
}): string {
  return [input.userId, input.type, input.entityId || '', input.title || ''].join('|');
}

/** True when `raw` is the same event as `identity` (see dedupeIdentity). */
export function sameEventIdentity(raw: RawNotification, identity: string): boolean {
  const [userId, type, entityId, title] = identity.split('|');
  return (
    str(raw.userId) === userId &&
    str(raw.type) === type &&
    (str(raw.entityId) || '') === entityId &&
    (str(raw.title) || '') === title
  );
}

/** Newest first — the order every inbox shows. */
export function sortNotificationsDesc<T extends RawNotification>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    const aMs = timestampToMillis(a.createdAt ?? a.timestamp ?? a.created) ?? 0;
    const bMs = timestampToMillis(b.createdAt ?? b.timestamp ?? b.created) ?? 0;
    return bMs - aMs;
  });
}