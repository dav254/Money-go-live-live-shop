/**
 * ONE PLACE THAT KNOWS A FIRESTORE DATE'S SHAPE.
 *
 * Ledger and moderation fields (`Payment.paymentDate`, `Complaint.createdAt`,
 * …) are typed `unknown` on purpose: the same column holds a Firestore
 * Timestamp at runtime, but the compiler is not allowed to assume it. Pages
 * kept calling `.toDate()` straight off `unknown` — a type error every time —
 * or `new Date(value)` on a Timestamp, which silently produces an Invalid Date
 * because Timestamp is not a number.
 *
 * This reads the two shapes that actually occur (a `Date`, or anything with
 * `toDate()`), and returns null for everything else so a render never throws
 * half-way down a table.
 */
export function firestoreDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const candidate = value as { toDate?: () => Date };
  if (typeof candidate.toDate === 'function') return candidate.toDate();
  return null;
}
