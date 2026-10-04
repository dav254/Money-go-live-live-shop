'use client';

import { ReferralRewardsScreen } from '@/components/app/referrals/referral-rewards-screen';

/**
 * BUYER APP · INVITE & EARN (`/app/buyer/rewards`).
 *
 * Buyers earn points too — the same escalating ladder as sellers, because the
 * growth lever that matters for a marketplace is a buyer telling another buyer
 * that it is worth joining, which no seller-side programme can substitute for.
 *
 * The rules live in `components/app/referrals/referral-rewards-screen` so the
 * two sections cannot drift apart when a tier changes.
 */
export default function BuyerRewardsPage() {
  return <ReferralRewardsScreen scope="buyer" />;
}
