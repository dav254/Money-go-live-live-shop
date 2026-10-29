/**
 * SHOP OPPORTUNITY AGENT — opportunity analysis (pure, deterministic).
 *
 * A transparent rubric, not a black box: every candidate gets the same five
 * weighted criteria, every criterion returns its own evidence-based
 * explanation, and the score is simply the sum of the met weights. The admin
 * UI renders the criteria verbatim, so "why is this business recommended?"
 * always has a concrete answer that can be audited against the stored source
 * fields.
 *
 * Hard rules (asserted by the tests):
 *   • Ratings, review counts, popularity and "business is struggling" style
 *     inferences are NEVER inputs — even when the source hands them to us,
 *     they are ignored and cannot change the score.
 *   • No contact basis or a suppressed / opted-out / expired candidate can
 *     never be `eligible`, whatever else is true.
 *   • The score only ever explains a recommendation; it never claims an
 *     outcome (no revenue predictions, no customer promises).
 */

import { DEFAULT_CATEGORIES } from './types';
import type { EligibilitySnapshot, ScoreCriterion, ShopAgentCandidate } from './types';

/** Recommendation thresholds (out of 100). */
export const ELIGIBLE_THRESHOLD = 60;
export const REVIEW_THRESHOLD = 35;

export const CRITERIA_WEIGHTS = {
  category_relevant: 30,
  online_presence: 15,
  contact_available: 20,
  outreach_permitted: 25,
  opportunity_evidence: 10,
} as const;

export const MAX_SCORE = Object.values(CRITERIA_WEIGHTS).reduce((a, b) => a + b, 0);

export interface ScoreInput {
  name: string;
  category: string;
  website: string | null;
  contact: { kind: string; value: string } | null;
  contactBasis: string | null;
  evidence: string[];
  suppressed: boolean;
  optOut: boolean;
  expired: boolean;
  /** Configurable category set (defaults to the pilot categories). */
  categories?: readonly string[];
}

/** Derives the score input from a stored candidate (single source of truth). */
export function scoreInputFromCandidate(candidate: ShopAgentCandidate, now: Date = new Date()): ScoreInput {
  return {
    name: candidate.name,
    category: candidate.category,
    website: candidate.website,
    contact: candidate.contact,
    contactBasis: candidate.contactBasis,
    evidence: candidate.evidence,
    suppressed: candidate.suppression.suppressed === true,
    optOut: candidate.suppression.reason === 'opt_out',
    expired: Number.isFinite(Date.parse(candidate.expiresAt)) && Date.parse(candidate.expiresAt) < now.getTime(),
  };
}

/**
 * The rubric. Each criterion is independent and explained in plain language
 * pointing at the stored evidence.
 */
export function scoreOpportunity(input: ScoreInput): EligibilitySnapshot {
  const categories = (input.categories ?? DEFAULT_CATEGORIES) as readonly string[];
  const category = input.category.trim().toLowerCase();
  const categoryRelevant = categories.some((c) => c.toLowerCase() === category || category.includes(c));

  const criteria: ScoreCriterion[] = [
    {
      id: 'category_relevant',
      label: 'Relevant to Vidnov’s marketplace',
      weight: CRITERIA_WEIGHTS.category_relevant,
      met: categoryRelevant,
      explanation: categoryRelevant
        ? `Category “${input.category}” matches Vidnov's marketplace categories (source field).`
        : `Category “${input.category}” is outside Vidnov's current marketplace categories (${categories.slice(0, 4).join(', ')}…).`,
    },
    {
      id: 'online_presence',
      label: 'Identifiable online presence',
      weight: CRITERIA_WEIGHTS.online_presence,
      met: Boolean(input.website),
      explanation: input.website
        ? `Source lists a public website (${input.website}) — the invitation can reference it.`
        : 'No public website found in the source data — a Vidnov shop link can complement its existing presence.',
    },
    {
      id: 'contact_available',
      label: 'A usable contact channel exists',
      weight: CRITERIA_WEIGHTS.contact_available,
      met: Boolean(input.contact && input.contact.value.trim()),
      explanation: input.contact
        ? `Source publishes a ${input.contact!.kind.replace('_', ' ')} contact channel for this business.`
        : 'The source publishes no contact channel — outreach would require one.',
    },
    {
      id: 'outreach_permitted',
      label: 'Outreach is permitted',
      weight: CRITERIA_WEIGHTS.outreach_permitted,
      met: outreachPermitted(input),
      explanation: outreachPermittedExplanation(input),
    },
    {
      id: 'opportunity_evidence',
      label: 'Evidence-based opportunity',
      weight: CRITERIA_WEIGHTS.opportunity_evidence,
      met: input.evidence.length > 0,
      explanation:
        input.evidence.length > 0
          ? `${input.evidence.length} source-derived evidence item(s): ${input.evidence[0]}`
          : 'No source-derived evidence recorded — nothing concrete to base an invitation on.',
    },
  ];

  const score = criteria.reduce((sum, c) => (c.met ? sum + c.weight : sum), 0);
  const permitted = outreachPermitted(input);
  const hasContact = Boolean(input.contact && input.contact.value.trim());

  let recommendation: EligibilitySnapshot['recommendation'];
  if (!permitted) recommendation = 'ineligible';
  else if (hasContact && score >= ELIGIBLE_THRESHOLD) recommendation = 'eligible';
  else if (score >= REVIEW_THRESHOLD) recommendation = 'needs_review';
  else recommendation = 'ineligible';

  return { score, maxScore: MAX_SCORE, recommendation, criteria, computedAt: new Date().toISOString() };
}

function outreachPermitted(input: ScoreInput): boolean {
  if (input.suppressed || input.optOut) return false;
  if (input.expired) return false;
  if (!input.contactBasis) return false;
  return true;
}

function outreachPermittedExplanation(input: ScoreInput): string {
  if (input.optOut) return 'The recipient has opted out — contacting them again is forbidden.';
  if (input.suppressed) return 'This contact is on the suppression list (manual or complaint) — outreach forbidden.';
  if (input.expired) return 'The source data has passed its retention deadline — refresh from the source before outreach.';
  if (!input.contactBasis) return 'No lawful contact basis recorded for this business — an admin must record one first.';
  return `Contact basis recorded: ${input.contactBasis} (source-published business channel).`;
}
