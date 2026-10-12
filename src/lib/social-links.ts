/**
 * SELLER SOCIAL LINKS.
 *
 * ## Why this exists
 *
 * A shop used to carry three hardcoded columns — `facebookUrl`,
 * `instagramUrl`, `twitterUrl` — and that is the whole problem: a seller with a
 * TikTok, a WhatsApp channel, a Telegram, a YouTube channel or a Threads
 * profile has nowhere to put it, and a seller with two TikToks has nowhere to
 * put the second one. Those three fields stay in the schema (see
 * `mergeSocialLinks`) so existing shops keep rendering, but `socialLinks` is
 * where anything new goes.
 *
 * ## No platform limit
 *
 * `socialLinks` is a list of `{ label, url }`, not a set of named columns. The
 * seller types whatever they want and the UI picks an icon from the hostname;
 * an unrecognised host gets a generic link icon rather than being rejected.
 * Locking sellers to three networks is what we are removing, not adding.
 *
 * ## Safety
 *
 * These URLs are rendered into `href` on a public storefront that a seller
 * fills in. `normalizeSocialUrl` is therefore the single gate: it only ever
 * returns `http:` or `https:` URLs, so `javascript:`, `data:` and `vbscript:`
 * cannot reach the DOM. Callers must use its output, never the raw input.
 */

export interface SocialLink {
  /** Stable within a shop document; generated on the client, never trusted. */
  id: string;
  /** What the seller typed, e.g. "TikTok". Falls back to the hostname. */
  label: string;
  /** Already normalized by `normalizeSocialUrl`. */
  url: string;
}

/**
 * Ceiling on saved links per shop.
 *
 * This is the one number in this file, and it is a document-size guard rather
 * than a product rule: a `sellerShops` document is capped at 1 MiB by
 * Firestore, and a link costs roughly 80 bytes. Nothing close to this limit
 * should ever be visible in normal use.
 */
export const MAX_SOCIAL_LINKS = 20;

/** Icon + hover colour chosen from the hostname; `link` is the fallback. */
export interface SocialPlatform {
  id:
    | 'facebook'
    | 'instagram'
    | 'whatsapp'
    | 'twitter'
    | 'tiktok'
    | 'youtube'
    | 'linkedin'
    | 'telegram'
    | 'pinterest'
    | 'threads'
    | 'snapchat'
    | 'reddit'
    | 'link';
  /** Tailwind background class applied on hover. */
  hover: string;
}

const PLATFORMS: { id: SocialPlatform['id']; hosts: string[]; hover: string }[] = [
  { id: 'facebook', hosts: ['facebook.com', 'fb.com', 'fb.me', 'm.facebook.com'], hover: 'hover:bg-blue-600' },
  { id: 'instagram', hosts: ['instagram.com', 'instagr.am'], hover: 'hover:bg-pink-600' },
  { id: 'whatsapp', hosts: ['wa.me', 'whatsapp.com', 'chat.whatsapp.com'], hover: 'hover:bg-green-600' },
  { id: 'twitter', hosts: ['twitter.com', 'x.com', 't.co'], hover: 'hover:bg-sky-500' },
  { id: 'tiktok', hosts: ['tiktok.com', 'vm.tiktok.com'], hover: 'hover:bg-pink-500' },
  { id: 'youtube', hosts: ['youtube.com', 'youtu.be', 'm.youtube.com'], hover: 'hover:bg-red-600' },
  { id: 'linkedin', hosts: ['linkedin.com', 'lnkd.in'], hover: 'hover:bg-sky-700' },
  { id: 'telegram', hosts: ['t.me', 'telegram.me', 'telegram.org'], hover: 'hover:bg-sky-600' },
  { id: 'pinterest', hosts: ['pinterest.com', 'pin.it'], hover: 'hover:bg-red-700' },
  { id: 'threads', hosts: ['threads.net', 'threads.com'], hover: 'hover:bg-neutral-600' },
  { id: 'snapchat', hosts: ['snapchat.com'], hover: 'hover:bg-yellow-500' },
  { id: 'reddit', hosts: ['reddit.com', 'redd.it'], hover: 'hover:bg-orange-600' },
];

const FALLBACK: SocialPlatform = { id: 'link', hover: 'hover:bg-white/20' };

/** Strip `www.`, lowercase, and ignore a leading `www2.` style prefix. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Turn whatever the seller typed into a safe absolute http(s) URL.
 *
 * Returns `null` when the input cannot be made into one. Callers surface that
 * as "that does not look like a link" rather than silently dropping it.
 */
export function normalizeSocialUrl(raw: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  // A bare handle ("@shop") or a bare host ("shop.com/page") has no scheme;
  // browsers would resolve those against the current origin, so add one.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  // The security gate. Only these two schemes may reach an `href`.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname.includes('.')) return null;

  return parsed.toString();
}

/** True when `raw` can be normalized into a safe absolute link. */
export function isSafeSocialUrl(raw: string): boolean {
  return normalizeSocialUrl(raw) !== null;
}

/** Icon/colour for a URL, by hostname. Never rejects — unknown hosts still show. */
export function socialPlatformFor(url: string): SocialPlatform {
  const host = hostOf(url);
  const match = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
  return match ?? FALLBACK;
}

/** Friendly default label: "TikTok" from tiktok.com, else the bare host. */
export function defaultLabelFor(url: string): string {
  const host = hostOf(url);
  if (!host) return 'Link';
  const first = host.split('.')[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Id for a newly added link. Only needs to be unique inside one shop. */
export function newLinkId(): string {
  return `l_${Math.random().toString(36).slice(2, 10)}`;
}

/** Read `socialLinks` defensively — the field is untrusted document data. */
export function readSocialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  const out: SocialLink[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<SocialLink>;
    const url = normalizeSocialUrl(typeof candidate.url === 'string' ? candidate.url : '');
    if (!url) continue;
    const label =
      typeof candidate.label === 'string' && candidate.label.trim()
        ? candidate.label.trim().slice(0, 40)
        : defaultLabelFor(url);
    out.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : newLinkId(),
      label,
      url,
    });
    if (out.length >= MAX_SOCIAL_LINKS) break;
  }
  return out;
}

/** Shape of the shop fields this module merges with `socialLinks`. */
export interface LegacySocialFields {
  socialLinks?: unknown;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  contactWhatsapp?: string;
}

/**
 * Everything a shop should show as a link: the free-form list first, then the
 * legacy columns that predate it.
 *
 * Legacy URLs that fail `normalizeSocialUrl` are dropped rather than rendered —
 * the website settings screen still accepts a bare `@handle` in the Instagram
 * and Twitter boxes, and rendering that as an `href` produced a link back to
 * the seller's own page.
 */
export function mergeSocialLinks(shop: LegacySocialFields | null | undefined): SocialLink[] {
  if (!shop) return [];

  const links = readSocialLinks(shop.socialLinks);
  const seen = new Set(links.map((l) => l.url.toLowerCase()));

  const legacy: { label: string; url?: string }[] = [
    { label: 'Facebook', url: shop.facebookUrl },
    { label: 'Instagram', url: shop.instagramUrl },
    { label: 'Twitter', url: shop.twitterUrl },
    {
      label: 'WhatsApp',
      url: shop.contactWhatsapp ? `https://wa.me/${shop.contactWhatsapp.replace(/\D/g, '')}` : undefined,
    },
  ];

  for (const item of legacy) {
    if (links.length >= MAX_SOCIAL_LINKS) break;
    const url = normalizeSocialUrl(item.url ?? '');
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ id: newLinkId(), label: item.label, url });
  }

  return links;
}

/** WhatsApp deep link from a saved link list, if the seller added one. */
export function whatsappLinkFor(links: SocialLink[]): SocialLink | undefined {
  return links.find((l) => socialPlatformFor(l.url).id === 'whatsapp');
}