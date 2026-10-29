/**
 * SHOP OPPORTUNITY AGENT — invitation copy builder (pure).
 *
 * Builds the personalised marketing package for one candidate: one honest,
 * source-grounded invitation rendered per channel, plus the tracked
 * registration link and a per-candidate opt-out link.
 *
 * Honesty rules enforced HERE, at build time (tests assert each):
 *   • Only the stored, permitted source fields are referenced (name, area,
 *     category, website) — nothing is inferred, no testimonials, no results
 *     are promised: `findFabrication` rejects the copy before it is stored.
 *   • Every variant carries clear sender identity and a working opt-out.
 *   • The registration link uses the EXISTING `camp` attribution parameter
 *     (`buildTrackedUrl`), so arrivals land in the same event spine as every
 *     other tracked link — no private tracking system.
 *   • Per-channel hard bounds (COPY_LIMITS) are applied by truncating the
 *     free-text body only — the opt-out line and link are never truncated
 *     away, because an unreachable opt-out is a compliance failure.
 */

import { buildTrackedUrl } from '../attribution/tracking';
import {
  COPY_LIMITS,
  findFabrication,
  optOutToken,
  type MessageVariants,
  type ShopAgentCandidate,
} from './types';

export interface BuildPackageInput {
  candidate: ShopAgentCandidate;
  /** Campaign id used as the `camp=` attribution value. */
  campaignId: string;
  /** Server-side secret used to sign the opt-out token. */
  secret: string;
  /** Absolute site origin, e.g. `https://vidnov.com` (no trailing slash). */
  siteOrigin: string;
  senderName: string;
}

export class CopyError extends Error {
  constructor(public readonly code: 'fabrication' | 'too_long' | 'missing_contact', message: string) {
    super(message);
    this.name = 'CopyError';
  }
}

/** `/signup` is the real account-creation route the invitation points at. */
export const REGISTRATION_PATH = '/signup';
export const OPTOUT_PATH = '/api/shop-agent/optout';

/** Sender identity line every variant carries. */
function senderLine(senderName: string): string {
  return `— ${senderName}, Vidnov (vidnov.com)`;
}

function optOutUrl(siteOrigin: string, candidateId: string, secret: string): string {
  return `${siteOrigin}${OPTOUT_PATH}?candidate=${encodeURIComponent(candidateId)}&token=${encodeURIComponent(
    optOutToken(candidateId, secret),
  )}`;
}

/** Trims free text while always keeping the opt-out tail intact. */
function boundedBody(core: string, tail: string, max: number): string {
  if (core.length + tail.length + 2 <= max) return `${core}\n\n${tail}`;
  const room = Math.max(0, max - tail.length - 3);
  return `${core.slice(0, room).trimEnd()}…\n\n${tail}`;
}

/**
 * Builds every channel variant for a candidate. Throws `CopyError` when the
 * generated copy trips the fabrication guard — a failed guard never stores a
 * package (fail closed, no partial copy).
 */
export function buildInvitationPackage(input: BuildPackageInput): MessageVariants {
  const { candidate, campaignId, secret, siteOrigin, senderName } = input;
  const name = candidate.name.trim();
  if (!name) throw new CopyError('missing_contact', 'Candidate has no business name.');

  const registrationLink = buildTrackedUrl(REGISTRATION_PATH, { campaign: campaignId });
  const optOutLink = optOutUrl(siteOrigin, candidate.id, secret);

  const where = candidate.area ? ` in ${candidate.area}` : '';
  const category = candidate.category || 'business';
  const siteRef = candidate.website ? ` I saw your site at ${candidate.website}` : '';

  const subject = `Invite: sell your ${category} on Vidnov${where}`.slice(0, COPY_LIMITS.subject);
  const emailCore =
    `Hello ${name},\n\n` +
    `I'm reaching out from Vidnov, an online marketplace for Kenyan businesses. ` +
    `You were listed as a ${category} business${where}.${siteRef}\n\n` +
    `You can create a free shop on Vidnov, list your products, and receive buyer requests and offers — ` +
    `here is your shop-registration link: ${registrationLink}\n\n` +
    `Registering takes a few minutes and our team can help you set up your first listings.`;
  const optOutTail = `Not the right contact, or prefer not to hear from us? Opt out here: ${optOutLink}`;
  const sign = senderLine(senderName);

  const email = boundedBody(`${emailCore}\n\n${sign}`, optOutTail, COPY_LIMITS.email);

  const whatsappCore =
    `Hello ${name}, this is Vidnov (vidnov.com). You were listed as a ${category} business${where}. ` +
    `Create a free shop and receive buyer requests here: ${registrationLink} — ${sign}`;
  const whatsapp = boundedBody(whatsappCore, `Opt out anytime: ${optOutLink}`, COPY_LIMITS.whatsapp);

  const smsCore = `Vidnov: ${name}, create a free shop for your ${category} business: ${registrationLink} — ${sign}`;
  const sms = boundedBody(smsCore, `Opt out: ${optOutLink}`, COPY_LIMITS.sms);

  // Fabrication guard runs across every variant AND the subject before the
  // package may be stored. A hit throws — nothing partially written.
  for (const [label, text] of [
    ['subject', subject],
    ['email', email],
    ['whatsapp', whatsapp],
    ['sms', sms],
  ] as const) {
    const hit = findFabrication(text);
    if (hit) throw new CopyError('fabrication', `Generated ${label} contains a forbidden claim (${hit}).`);
  }

  // Bounds are a hard guarantee, not a hope.
  assertBound('subject', subject, COPY_LIMITS.subject);
  assertBound('email', email, COPY_LIMITS.email);
  assertBound('whatsapp', whatsapp, COPY_LIMITS.whatsapp);
  assertBound('sms', sms, COPY_LIMITS.sms);

  return { subject, email, whatsapp, sms, registrationLink, optOutLink };
}

function assertBound(label: string, text: string, max: number): void {
  if (text.length > max) throw new CopyError('too_long', `${label} exceeds ${max} characters.`);
}

/**
 * The poster prompt is deliberately generic — it can only reference the
 * business NAME and CATEGORY (facts from the source). No logo, no photos, no
 * product imagery claims: generated art is a clearly labelled mockup, and the
 * asset record keeps `state: 'generated'` until an admin approves it.
 */
export function posterPrompt(candidate: ShopAgentCandidate): string {
  const label = candidate.name.trim() || 'Local business';
  const category = candidate.category || 'business';
  return (
    `Clean promotional poster mockup for a Kenyan ${category} business called "${label}". ` +
    `Modern marketplace invitation style, warm colors, simple geometric layout, ` +
    `placeholder text areas, no real logos, no real people, clearly a design mockup.`
  );
}
