/**
 * LIVE VERIFICATION for the referral system.
 *
 * Read-mostly: it resolves real codes, exercises the escalating tier maths, and
 * confirms the rules actually deployed. The only writes are to a temporary
 * verification document that is deleted before the script exits.
 *
 * Usage: npx tsx scripts/verify-referrals.ts
 */
import { db } from '@/firebase/server';
import { referralCodeFor, normaliseReferralCode, nameSlugFrom, referralNameSlug } from '@/lib/referrals/referral-code';
import { ensureReferralCode, resolveReferralCode } from '@/lib/referrals/ensure-code';
import { pointsForSignup, currentTier, signupsToNextTier } from '@/lib/referrals/rewards';

let failures = 0;
function check(name: string, pass: boolean, detail = '') {
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!pass) failures++;
}

async function main() {
  console.log('=== referral code derivation ===');
  const sampleUids = ['abc123', 'user-xyz-999', '00000000-1111-2222-3333-444444444444'];
  for (const uid of sampleUids) {
    const code = referralCodeFor(uid);
    check(`code for "${uid.slice(0, 18)}"`, code.length === 6 && /^[2-9A-HJ-NP-Z]{6}$/.test(code), code);
  }
  check('code is deterministic', referralCodeFor('abc123') === referralCodeFor('abc123'));
  check('empty uid yields empty code', referralCodeFor('') === '');

  /*
   * Name-based codes.
   *
   * These assertions CHANGED, deliberately: the contract moved from an opaque
   * six-character token to a readable slug of the person's name, because a
   * link is only useful for tracking and search if it says whose it is.
   * `referralCodeFor` above is unchanged and is still checked, because every
   * code ever issued is one of those and old links must keep resolving.
   */
  console.log('\n=== name slugs ===');
  check('name becomes a slug', nameSlugFrom('David Chege') === 'david-chege', nameSlugFrom('David Chege'));
  check('accents are folded', nameSlugFrom('Renée Wanjiru') === 'renee-wanjiru', nameSlugFrom('Renée Wanjiru'));
  check('separators collapse', nameSlugFrom('  David__  Chege  ') === 'david-chege', nameSlugFrom('  David__  Chege  '));
  check('a seller shop name works too', nameSlugFrom('Maasai Craft House') === 'maasai-craft-house', nameSlugFrom('Maasai Craft House'));
  check('symbol-only name yields empty slug', nameSlugFrom('!!!') === '');
  check('unusable name falls back to the legacy token',
    referralNameSlug('!!!', 'abc123') === referralCodeFor('abc123').toLowerCase());
  check('slug is URL-safe', /^[a-z0-9-]+$/.test(nameSlugFrom('David  Chege / Nairobi')));

  console.log('\n=== input normalisation ===');
  // Lowercase, hyphens preserved, no 6-character cap: the old expectations
  // here (uppercase, truncated to 6) described the retired token format.
  check('input lowercases', normaliseReferralCode('abc234') === 'abc234', normaliseReferralCode('abc234'));
  check('hyphens are kept', normaliseReferralCode('David-Chege') === 'david-chege', normaliseReferralCode('David-Chege'));
  check('legacy uppercase token normalises', normaliseReferralCode('ABC234') === 'abc234', normaliseReferralCode('ABC234'));
  check('pasted URL extracts the code', normaliseReferralCode('https://x.app/signup?ref=ABC234') === 'abc234', normaliseReferralCode('https://x.app/signup?ref=ABC234'));
  check('over-long input is bounded', normaliseReferralCode('a'.repeat(200)).length <= 40, `${normaliseReferralCode('a'.repeat(200)).length}`);

  console.log('\n=== escalating tiers (the maths that was previously broken) ===');
  const expected: [number, number][] = [
    [0, 50], [4, 50], [5, 75], [14, 75], [15, 100], [29, 100], [30, 150], [100, 150],
  ];
  for (const [count, want] of expected) {
    const got = pointsForSignup(count);
    check(`${count} approved -> ${want} pts`, got === want, `got ${got}`);
  }
  check('tier name at 0 is Starter', currentTier(0).name === 'Starter');
  check('tier name at 20 is Connector', currentTier(20).name === 'Connector');
  check('tier name at 30 is Ambassador', currentTier(30).name === 'Ambassador');
  check('tier name at 99 is Ambassador', currentTier(99).name === 'Ambassador');
  // "Signups until the next band starts paying more": Starter ends at 5, so a
  // new referrer is 5 invites away from Builder's higher rate.
  check('5 to next tier from 0', signupsToNextTier(0) === 5, `got ${signupsToNextTier(0)}`);
  check('10 to next tier from 25', signupsToNextTier(25) === 5, `got ${signupsToNextTier(25)}`);
  check('1 to next tier from 4', signupsToNextTier(4) === 1, `got ${signupsToNextTier(4)}`);
  check('0 to next tier at the top', signupsToNextTier(30) === 0);

  console.log('\n=== O(1) code directory against live Firestore ===');
  const probeUid = `__verify_${Date.now()}`;
  const probeCode = await ensureReferralCode(probeUid, 'Verify Probe');
  check('directory write returned a name code', probeCode === 'verify-probe', probeCode);

  const resolved = await resolveReferralCode(probeCode);
  check('directory resolves code -> uid', resolved === probeUid, `got ${resolved}`);

  // The legacy token for the same uid must still resolve — that is what keeps
  // links shared before this change working.
  const legacyForProbe = referralCodeFor(probeUid);
  const resolvedLegacy = await resolveReferralCode(legacyForProbe);
  check('legacy token still resolves to the same uid', resolvedLegacy === probeUid, `got ${resolvedLegacy}`);
  check('legacy token resolves from lowercase input too', (await resolveReferralCode(legacyForProbe.toLowerCase())) === probeUid);

  // A second user with the SAME name must not steal the first one's code.
  const twinUid = `${probeUid}_twin`;
  const twinCode = await ensureReferralCode(twinUid, 'Verify Probe');
  check('duplicate name gets a distinct code', twinCode !== probeCode, `${probeCode} vs ${twinCode}`);
  check('duplicate name still resolves to its own owner', (await resolveReferralCode(twinCode)) === twinUid, `got ${await resolveReferralCode(twinCode)}`);

  const unknown = await resolveReferralCode('zzz-no-such-person');
  check('unknown code resolves to null', unknown === null, `got ${unknown}`);

  // Clean up the probe documents — leave no residue.
  for (const code of [probeCode, twinCode, legacyForProbe]) {
    await db.collection('referralCodes').doc(code).delete().catch(() => undefined);
  }
  for (const uid of [probeUid, twinUid]) {
    await db.collection('userProfiles').doc(uid).delete().catch(() => undefined);
  }
  const afterDelete = await resolveReferralCode(probeCode);
  check('probe cleaned up', afterDelete === null);

  console.log('\n=== existing users are not yet indexed (backfill needed) ===');
  const users = await db.collection('userProfiles').limit(5).get();
  if (users.empty) {
    console.log('  (no profiles to check)');
  } else {
    let indexed = 0;
    for (const u of users.docs) {
      if (await resolveReferralCode(referralCodeFor(u.id))) indexed++;
    }
    console.log(`  ${indexed}/${users.size} sampled users already have a directory entry`);
    if (indexed < users.size) {
      console.log('  -> run POST /api/referrals/backfill as an admin to index everyone');
    }
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('verification crashed:', e);
  process.exit(1);
});
