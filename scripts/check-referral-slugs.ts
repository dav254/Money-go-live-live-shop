/**
 * SHOWS the name slugs now stored on real profiles.
 *
 * Read-only. Exists so the backfill can be checked by eye rather than taken on
 * trust — a marketplace where every invite link should name its inviter is
 * only useful if the slugs actually look like names.
 */
import { db } from '@/firebase/server';
import { normaliseReferralCode } from '@/lib/referrals/referral-code';

const SAMPLE = 12;

async function main() {
  const snap = await db.collection('userProfiles').limit(200).get();
  const docs = snap.docs;

  let withSlug = 0;
  const rows: string[] = [];

  for (const doc of docs) {
    const data = doc.data() as { referralSlug?: string; fullName?: string };
    const slug = normaliseReferralCode(data.referralSlug || '');
    if (slug) withSlug++;
    if (rows.length < SAMPLE) {
      rows.push(
        `${slug ? 'OK  ' : 'none'} ${slug.padEnd(24)} name=${(data.fullName || '(no name)').slice(0, 28)}`,
      );
    }
  }

  console.log('sample:');
  rows.forEach((r) => console.log('  ' + r));
  console.log(`\n${withSlug}/${docs.length} sampled profiles carry a name slug`);
  if (withSlug < docs.length) {
    console.log('-> re-run: npx tsx scripts/backfill-referral-codes.ts');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
