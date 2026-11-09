import React from 'react';

import { RequireAuth } from '../src/components/require-auth';
import { ReferralRewards } from '../src/components/referral-rewards';

/**
 * INVITE & EARN (buyer) — the native twin of `/app/buyer/rewards`.
 *
 * Same balance, same invite link, same server-side redemption as the seller
 * route; only the entry point differs, exactly like the website.
 */
export default function BuyerRewardsScreen() {
  return (
    <RequireAuth>
      <ReferralRewards role="buyer" />
    </RequireAuth>
  );
}
