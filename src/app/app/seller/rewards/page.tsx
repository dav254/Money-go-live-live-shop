'use client';

import { ReferralRewardsScreen } from '@/components/app/referrals/referral-rewards-screen';

/**
 * SELLER APP · INVITE & EARN (`/app/seller/rewards`).
 *
 * A seller inviting other SELLERS is the growth lever this section is really
 * for: a seller who brings in three other sellers brings their catalogues,
 * their audiences and their fulfilment capacity with them, which is worth far
 * more than one extra buyer.
 *
 * The escalation is what makes it work. A flat per-signup reward means the
 * tenth seller is worth exactly what the first was, so the only rational move
 * is to spam. Paying more per signup as the network grows means the incentive
 * is to bring in people who will themselves bring in people.
 *
 * Same component as the buyer's screen — same tiers, same spend options, same
 * arithmetic. Only the shell around it differs.
 */
export default function SellerRewardsPage() {
  return <ReferralRewardsScreen scope="seller" />;
}
