/**
 * REFERRAL CODES — the invite link carries the inviter's NAME.
 *
 * ## Why this changed
 *
 * Codes used to be six random uppercase characters (`YUVMVT`). They were fine
 * as an opaque token and wrong as a link: pasted into WhatsApp or a support
 * ticket they told nobody anything, they could not be traced back to a person
 * without a database lookup, and they gave search engines nothing to index.
 * A marketplace where the buyer is recruited by a named person should say so in
 * the URL — `vidnov.com/signup?ref=david-chege` is self-explaining, greppable
 * in the logs, and crawlable.
 *
 * So the primary code is now a slug of the person's name. This applies to
 * sellers exactly as it does to buyers: both roles render this same screen, so
 * a shop owner shares `?ref=mauthai-store` the same way a buyer shares
 * `?ref=david-chege`.
 *
 * ## Legacy codes keep working
 *
 * Every code ever issued is still resolvable. `referralCodeFor(uid)` is
 * unchanged and still derives the old six-character token, and
 * `ensureReferralCode` indexes BOTH the name slug and the legacy token against
 * the same uid. A link shared before this change therefore still credits the
 * right person — we are adding names, not removing tokens.
 */

import { publicOrigin } from '@/lib/site-url';

/** Alphabet without visually ambiguous characters: no 0/O, 1/I/L. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Base-36ish digits per uid character consumed per output character. */
const UID_CHARS_PER_CODE_CHAR = 2;

/** A legacy referral code is always this long. */
export const REFERRAL_CODE_LENGTH = 6;

/**
 * Longest slug we will accept back off a URL.
 *
 * Not a security boundary — the server re-verifies by reading the code
 * directory — just a bound so a pasted whole sentence cannot become a document
 * id in a point read.
 */
export const REFERRAL_SLUG_MAX_LENGTH = 40;

/**
 * Folds a uid into a fixed-length legacy code.
 *
 * Kept for two reasons: it is the fallback for a user with no usable name, and
 * it is what every code ever issued is, so old links keep resolving.
 */
export function referralCodeFor(uid: string): string {
  if (!uid) return '';
  let out = '';
  let acc = 0;
  let bits = 0;

  for (let i = 0; i < uid.length; i++) {
    acc = acc * 31 + uid.charCodeAt(i);
    bits += 5;
    while (bits >= 5 && out.length < REFERRAL_CODE_LENGTH) {
      out += ALPHABET[acc % ALPHABET.length];
      acc = Math.floor(acc / ALPHABET.length);
      bits -= 5;
    }
  }

  // Pad if the uid was pathologically short, so every code is the same length.
  while (out.length < REFERRAL_CODE_LENGTH) out += ALPHABET[0];
  return out;
}

/**
 * Turns a name into a URL slug: `David Chege` → `david-chege`.
 *
 * Accents are folded rather than dropped (`é` → `e`) so a name is not mangled
 * into a different word, and runs of separators collapse to a single hyphen so
 * `david__chege` and `david chege` produce the same code.
 *
 * Returns '' for input that carries no letters or digits, which is the signal
 * to fall back to the legacy code rather than mint an empty one.
 */
export function nameSlugFrom(name: string | null | undefined): string {
  if (!name) return '';
  const slug = name
    .normalize('NFKD')
    // Strip the combining marks NFKD just split off, so "é" → "e".
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, REFERRAL_SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
  return slug;
}

/**
 * The base slug for a user's referral code, before collision handling.
 *
 * Pure: it cannot know whether `david-chege` is already claimed, so
 * `ensureReferralCode` appends `-2`, `-3` and so on at write time. Prefer that
 * for anything user-facing.
 */
export function referralNameSlug(name: string | null | undefined, uid: string): string {
  return nameSlugFrom(name) || referralCodeFor(uid).toLowerCase();
}

/** Normalises user input (a pasted URL, mixed case, stray spaces) into a code. */
export function normaliseReferralCode(input: string): string {
  if (!input) return '';
  // Accept a pasted invite URL as well as a bare code.
  const fromUrl = input.match(/[?&]ref=([^&#\s]+)/);
  const raw = (fromUrl ? fromUrl[1] : input).trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, REFERRAL_SLUG_MAX_LENGTH);
}

/** The shareable invite link for a code. */
export function inviteLinkFor(code: string, origin?: string): string {
  // A live browser uses its own origin so a dev link points at the dev server;
  // everywhere else falls back to the configured public origin (vidnov.com).
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : publicOrigin());
  return `${base}/signup?ref=${code}`;
}

/**
 * The message shown next to the copy button. Kept here so the buyer and seller
 * screens cannot drift into promising different things.
 */
export function inviteShareText(code: string, points: number): string {
  return `Join me on Vidnov and start shopping with live video. Use my code ${code} when you sign up — we both get ${points} points.`;
}
