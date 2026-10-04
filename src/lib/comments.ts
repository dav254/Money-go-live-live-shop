/**
 * Commenter identity.
 *
 * ## Why "Anonymous" was the default
 *
 * `video-card.tsx` wrote `user.displayName || 'Anonymous'` when posting a
 * comment. Firebase accounts created by email/password or Google frequently
 * have no `displayName` at all, so perfectly identifiable buyers were being
 * filed under "Anonymous" — and a comment thread where every row says
 * Anonymous tells a buyer nothing about who they are dealing with, which is
 * exactly the transparency a marketplace needs.
 *
 * ## What we use instead, in order
 *
 *   1. `displayName` — what the person chose.
 *   2. The part of the email before the `@` — `david.chege@gmail.com` reads as
 *      "david.chege", which is a person, not a placeholder.
 *   3. "Buyer" — still a role rather than an anonymous shrug, and it never
 *      claims to be a name we do not have.
 *
 * The uid is only used as a stable seed for the avatar fallback, never shown.
 */

export function resolveCommenterName(
  user: { displayName?: string | null; email?: string | null } | null | undefined,
): string {
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;

  const email = user?.email?.trim();
  if (email) {
    const local = email.split('@')[0]?.trim();
    // A bare "@" or a one-character local part is not a name.
    if (local && local.length > 1) return local;
  }

  return 'Buyer';
}

/** First letter for an avatar fallback, from whichever name we resolved. */
export function commenterInitial(
  user: { displayName?: string | null; email?: string | null } | null | undefined,
): string {
  return resolveCommenterName(user).charAt(0).toUpperCase();
}
