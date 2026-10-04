/**
 * PUSH PREFERENCES — per-category opt-in, and the rules that decide what to send.
 *
 * ## One switch per section, as the feature asks
 *
 * A user does not think in notification TYPES (`GENERATION_COMPLETE`), they
 * think in sections ("live streams", "orders", "payments"). The categories
 * below are those sections, and the settings screen renders exactly this list,
 * so adding a category here makes a new switch appear rather than silently
 * folding into an existing one.
 *
 * ## Defaults are ON, because the failure mode matters
 *
 * The dangerous default is OFF: a user opts in to order and payment alerts,
 * a deploy quietly changes the default, and a payment confirmation silently
 * stops reaching their phone. Shipping with everything enabled means a new
 * category notifies by default and an admin opts out deliberately, which is the
 * recoverable direction.
 *
 * ## Security is not a preference
 *
 * A new sign-in or a changed password always sends, whatever the user has
 * toggled. Silencing that category is a legitimate preference for noise, but a
 * hijacked account is not noise — and a user who has turned off everything else
 * still needs to be told when someone else logs into their account.
 */

import type { Firestore } from 'firebase-admin/firestore';

/**
 * The Admin SDK's Firestore, matching the engine's `db`.
 *
 * Typed rather than duck-typed so a preference read that needs a composite
 * index or a transaction fails at compile time instead of at 3am.
 */
type PrefDb = Firestore;

export type PushCategory =
  | 'orders'
  | 'messages'
  | 'payments'
  | 'ai'
  | 'business'
  | 'live'
  | 'system';

/** Sections the user can toggle, in the order the settings screen shows them. */
export const PUSH_CATEGORIES: {
  id: PushCategory;
  label: string;
  description: string;
}[] = [
  {
    id: 'orders',
    label: 'Orders & delivery',
    description: 'Order confirmations, dispatch and delivery updates.',
  },
  {
    id: 'payments',
    label: 'Payments & refunds',
    description: 'Payments received, refunds and payouts.',
  },
  {
    id: 'messages',
    label: 'Messages',
    description: 'New chats and replies from buyers and sellers.',
  },
  {
    id: 'live',
    label: 'Live streams',
    description: 'When a seller you follow goes live.',
  },
  {
    id: 'ai',
    label: 'AI generation',
    description: 'When a generation finishes, fails, or points run low.',
  },
  {
    id: 'business',
    label: 'Shop & reviews',
    description: 'Listing approvals, rejections and new reviews.',
  },
  {
    id: 'system',
    label: 'System & storage',
    description: 'Storage warnings, sync failures and service notices.',
  },
];

/**
 * Categories that ignore the user's preference.
 *
 * A security alert is the one thing where "the user asked us not to" is not a
 * good enough reason to stay quiet.
 */
const ALWAYS_ON: ReadonlySet<string> = new Set(['security']);

/** True when a notification in `category` should be pushed. */
export async function isPushEnabledFor(
  db: PrefDb,
  userId: string,
  category: string,
): Promise<boolean> {
  if (!userId) return false;
  if (ALWAYS_ON.has(category)) return true;

  try {
    const snap = await db.doc(`users/${userId}/settings/push`).get();
    if (!snap.exists) return true; // default on — see the file header

    const prefs = snap.data() as { categories?: Record<string, boolean> } | undefined;
    const value = prefs?.categories?.[category];
    // A category with no explicit setting follows the global switch, and
    // follows ON when that is also unset.
    return value !== false;
  } catch {
    // An unreadable preference must not silence a payment alert.
    return true;
  }
}
