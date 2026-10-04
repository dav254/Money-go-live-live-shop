/**
 * BUSINESS VERIFICATION — trust you can point at.
 *
 * ## The statuses, and what each one actually promises
 *
 *   unverified  →  nobody has checked anything
 *   submitted   →  the seller sent documents; a human has NOT looked yet
 *   verified    →  a human approved it and the seller is a real business
 *   rejected    →  looked at, and not good enough; may try again
 *
 * The one that matters is `verified`, and it must mean a person looked. The
 * whole point of the badge is that a buyer can trust it, so a badge that can be
 * self-asserted is worse than no badge — it teaches buyers to trust a tick that
 * means nothing.
 *
 * ## Why documents are NOT public
 *
 * A business registration certificate carries a registration number and a
 * founder's name. That goes in a server-only path an admin reads; the public
 * document only ever holds the *status* and, once approved, a non-sensitive
 * reference. Nothing readable by other users contains the raw file.
 */

/**
 * The four states, mapped onto the field that ALREADY EXISTS.
 *
 * `userProfiles.verificationStatus` was already `'pending' | 'verified' |
 * 'rejected'` and is already written by the admin queue at
 * `/dashboard/admin/users/verification` (which queries `== 'pending'`). There
 * are also live profiles carrying those values.
 *
 * So the four states the business wants are derived, not invented:
 *
 *   field absent      → Unverified            (nobody has looked)
 *   'pending'         → Documents submitted   (sent, not yet read)
 *   'verified'        → Verified business     (a human approved it)
 *   'rejected'        → Not verified          (looked at, not good enough)
 *
 * Introducing a parallel 'submitted' value would have silently emptied the
 * existing admin queue — the seller who submitted would never appear in the
 * queue that is supposed to review them. That is exactly the kind of
 * half-migration that loses work, so the vocabulary was changed to fit the
 * data instead of the other way round.
 */
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  'unverified',
  'pending',
  'verified',
  'rejected',
];

export function isVerificationStatus(v: unknown): v is VerificationStatus {
  return typeof v === 'string' && (VERIFICATION_STATUSES as string[]).includes(v);
}

export interface VerificationMeta {
  label: string;
  /** Shown under the label so a badge never over-promises. */
  detail: string;
  tone: 'neutral' | 'pending' | 'good' | 'bad';
}

/** One table, so the buyer, the seller and the admin cannot describe a status differently. */
export const VERIFICATION_META: Record<VerificationStatus, VerificationMeta> = {
  unverified: {
    label: 'Unverified',
    detail: 'This seller has not been checked yet.',
    tone: 'neutral',
  },
  pending: {
    label: 'Documents submitted',
    detail: 'Waiting for our team to review the documents.',
    tone: 'pending',
  },
  verified: {
    label: 'Verified business',
    detail: 'Our team checked these documents and approved them.',
    tone: 'good',
  },
  rejected: {
    label: 'Not verified',
    detail: 'The documents did not pass our check. The seller may try again.',
    tone: 'bad',
  },
};

/**
 * The ONLY transition a client is ever allowed to make.
 *
 * A seller can submit (or re-submit after a rejection). They cannot approve
 * themselves — `verified` is reachable only through the admin path, which is
 * server-side. Anything else here would be a badge a seller buys themselves.
 */
export function allowedSellerTransition(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  if (from === to) return false;
  if (from === 'verified') return false; // an approval is not revocable by the seller
  if (to === 'pending') return true; // submit, or re-submit after a rejection
  return false;
}

export function verificationMeta(status: unknown): VerificationMeta {
  return isVerificationStatus(status) ? VERIFICATION_META[status] : VERIFICATION_META.unverified;
}

/**
 * WHICH VERIFICATION THE BADGE SHOULD SHOW.
 *
 * ## The broken loop this exists to close
 *
 * Two writers, one reader, and they were pointed at different documents:
 *
 *   - `/dashboard/account` writes `userProfiles/{uid}.verificationStatus = 'pending'`
 *   - `/dashboard/admin/users/verification` approves the same field
 *   - the public badge read `businesses/{id}.verificationStatus`, which nothing
 *     ever writes
 *
 * So a seller could submit, an admin could approve, and the shop page would go
 * on saying "Unverified" forever. Not a crash — the whole point of verification
 * is that nobody is watching, which is why a silently discarded approval is the
 * most expensive kind of bug here.
 *
 * ## The rule
 *
 * **A business decision wins; otherwise the account answers.**
 *
 * The subtle part is what counts as a business "decision". On a business,
 * `verified`, `pending` and `rejected` can only have been written by a real
 * actor, so they are authoritative. `unverified` cannot: nothing in the product
 * ever *decides* that — a backfill writes it as a placeholder for "nobody has
 * looked yet". Treating a placeholder as a decision is how an admin's approval
 * gets silently thrown away, which is the exact failure this function exists
 * to close. So `unverified` on a business falls through to the account.
 *
 * Per-business verification is the right end state — one person can run a
 * verified sole trader and an unverified company, and the company badge should
 * say so. That needs an admin path that writes business statuses. The moment
 * one exists, `unverified` becomes a real decision on a business and must be
 * added to the authoritative set below.
 *
 * `source` is returned so the two can be told apart while that migration runs.
 * It is not shown to buyers: a seller should not be able to tell a buyer that
 * their badge is the legacy kind.
 */

/** The statuses on a business that only a real actor could have produced. */
const BUSINESS_DECISIONS: VerificationStatus[] = ['verified', 'pending', 'rejected'];

export function resolveEffectiveVerification(
  businessStatus: unknown,
  accountStatus: unknown,
): { status: VerificationStatus; source: 'business' | 'account' | 'none' } {
  if (isVerificationStatus(businessStatus) && BUSINESS_DECISIONS.includes(businessStatus)) {
    return { status: businessStatus, source: 'business' };
  }
  if (isVerificationStatus(accountStatus) && accountStatus !== 'unverified') {
    return { status: accountStatus, source: 'account' };
  }
  return { status: 'unverified', source: 'none' };
}

/** The public, non-sensitive half of a verification record. */
export function publicVerification(status: unknown): {
  status: VerificationStatus;
  label: string;
  detail: string;
} {
  const meta = verificationMeta(status);
  return {
    status: isVerificationStatus(status) ? status : 'unverified',
    label: meta.label,
    detail: meta.detail,
  };
}

/** Document kinds we ask for. Kept loose so a new country is not a code change. */
export const VERIFICATION_DOC_TYPES = [
  { key: 'registration', label: 'Business registration certificate' },
  { key: 'id', label: 'Owner / director ID' },
  { key: 'tax', label: 'Tax registration (PIN / VAT)' },
  { key: 'bank', label: 'Bank account confirmation' },
] as const;

export type VerificationDocType = (typeof VERIFICATION_DOC_TYPES)[number]['key'];
