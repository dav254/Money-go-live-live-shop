/**
 * Indexes every existing user's referral code into `referralCodes`.
 *
 * Run once after the directory is introduced. Idempotent, so re-running is
 * harmless. Usage: npx tsx scripts/backfill-referral-codes.ts
 */
import { backfillReferralCodes } from '@/lib/referrals/ensure-code';

async function main() {
  console.log('Backfilling referral code directory…');
  const result = await backfillReferralCodes((done) => {
    process.stdout.write(`\r  indexed ${done}…`);
  });
  process.stdout.write('\n');
  console.log(`Done. indexed=${result.indexed} failed=${result.failed}`);
}

main().catch((e) => {
  console.error('Backfill failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
