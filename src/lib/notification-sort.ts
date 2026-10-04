/**
 * Notification helpers.
 *
 * The `notifications` collection has no deployed composite index for
 * `userId + timestamp` / `userId + createdAt`, so any server-side orderBy on
 * those fields fails with FAILED_PRECONDITION. We sort the (small) result set
 * client-side instead.
 */

type DateLike = { toMillis?: () => number; toDate?: () => Date } | number | string | null | undefined;

/** Best-effort conversion of Firestore Timestamp / Date / string / number to ms. */
export function toMillis(value: DateLike): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return 0;
}

/** Sorts notifications newest-first, preferring `createdAt` then `timestamp`. */
export function sortNotificationsDesc<T extends { createdAt?: unknown; timestamp?: unknown }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aTime = toMillis(a.createdAt as DateLike) || toMillis(a.timestamp as DateLike);
    const bTime = toMillis(b.createdAt as DateLike) || toMillis(b.timestamp as DateLike);
    return bTime - aTime;
  });
}