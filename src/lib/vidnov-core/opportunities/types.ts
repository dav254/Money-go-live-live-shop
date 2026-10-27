/**
 * OPPORTUNITIES — state machine & ids (pure).
 *
 * Business-funded tasks. States are explicit and every move between them goes
 * through `canTransition*` — no free-form status strings anywhere.
 *
 * Money: `budget.amountMinor` is a FUNDING DECLARATION in integer minor
 * units. It is never a balance, never client-set, and nothing in this engine
 * converts it into a payable amount (see trust/ledger.ts).
 */

export const OPPORTUNITY_STATES = ['draft', 'open', 'closed', 'cancelled'] as const;
export type OpportunityState = (typeof OPPORTUNITY_STATES)[number];

export const OPPORTUNITY_TRANSITIONS: Record<OpportunityState, readonly OpportunityState[]> = {
  draft: ['open', 'cancelled'],
  open: ['closed', 'cancelled'],
  closed: ['open'], // reopen is a deliberate admin action
  cancelled: [],
};

export function canTransitionOpportunity(from: OpportunityState, to: OpportunityState): boolean {
  if (from === to) return true;
  return (OPPORTUNITY_TRANSITIONS[from] ?? []).includes(to);
}

export const APPLICATION_STATES = ['submitted', 'under_review', 'approved', 'rejected', 'withdrawn'] as const;
export type ApplicationState = (typeof APPLICATION_STATES)[number];

export const APPLICATION_TRANSITIONS: Record<ApplicationState, readonly ApplicationState[]> = {
  submitted: ['under_review', 'approved', 'rejected', 'withdrawn'],
  under_review: ['approved', 'rejected', 'withdrawn'],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export function canTransitionApplication(from: ApplicationState, to: ApplicationState): boolean {
  if (from === to) return true;
  return (APPLICATION_TRANSITIONS[from] ?? []).includes(to);
}

export const REVIEW_STATES = ['pending', 'approved', 'disputed', 'resolved'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/**
 * Deterministic application id: one application per (opportunity, applicant).
 * A double-tapped "Apply" resolves to the SAME document — never two.
 */
export function applicationDocId(opportunityId: string, applicantUid: string): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');
  return `${safe(opportunityId)}__${safe(applicantUid)}`.slice(0, 300);
}

/** True while the opportunity's application window is open (server clock). */
export function isWithinWindow(startsAt: string | number | Date, endsAt: string | number | Date, now: Date = new Date()): boolean {
  const s = Date.parse(String(startsAt));
  const e = Date.parse(String(endsAt));
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  const t = now.getTime();
  return t >= s && t <= e;
}
