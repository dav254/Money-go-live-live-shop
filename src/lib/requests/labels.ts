import type { MarketplaceRequest } from './types';

/** Budget display used across customer + seller marketplace views. */
export function budgetLabel(
  request: Pick<MarketplaceRequest, 'currency' | 'budgetMin' | 'budgetMax'>,
): string {
  const cur = request.currency || 'KES';
  if (request.budgetMin && request.budgetMax) return `${cur} ${request.budgetMin.toLocaleString()} – ${request.budgetMax.toLocaleString()}`;
  if (request.budgetMax) return `Up to ${cur} ${request.budgetMax.toLocaleString()}`;
  if (request.budgetMin) return `From ${cur} ${request.budgetMin.toLocaleString()}`;
  return 'Flexible budget';
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  deleted: 'Deleted',
};

export const OFFER_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  declined: 'Declined',
  accepted: 'Accepted',
  withdrawn: 'Withdrawn',
};
