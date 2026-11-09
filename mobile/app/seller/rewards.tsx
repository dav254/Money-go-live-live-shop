import React from 'react';

import { RequireAuth } from '../../src/components/require-auth';
import { ReferralRewards } from '../../src/components/referral-rewards';
import { SellerHeader } from '../../src/components/seller/seller-header';

/**
 * INVITE & EARN (seller) — mirrors `/app/seller/rewards`.
 *
 * A seller recruiting another seller brings a catalogue and an audience with
 * them, which is why the website gives this its own row in both drawers. The
 * screen itself is the shared one, so a buyer and a seller can never be shown
 * two different balances for the same account.
 */
export default function SellerRewardsScreen() {
  return (
    <RequireAuth>
      <ReferralRewards role="seller" header={<SellerHeader title="Invite & earn" showBack />} />
    </RequireAuth>
  );
}
