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
 *
 * WHY THIS MODULE IS SERVER-FREE
 * The settings screen (`push-settings-screen.tsx`, a client component) imports
 * `PUSH_CATEGORIES` from here, so everything in this file must stay free of
 * server imports. `isPushEnabledFor` — the delivery gate that reads stored
 * preferences — therefore lives in `./store` next to `getPushPrefs`. A top-level
 * import of the store used to drag firebase-admin into the browser bundle and
 * fail the production build ("Can't resolve 'http2'/'child_process'").
 */

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
export const ALWAYS_ON: ReadonlySet<string> = new Set(['security']);

/*
 * The delivery gate (`isPushEnabledFor`) lives in `./store` — it reads the
 * stored preferences, and this module stays client-safe so the settings
 * screen can import `PUSH_CATEGORIES` without pulling the server store (and
 * firebase-admin) into the browser bundle.
 */
