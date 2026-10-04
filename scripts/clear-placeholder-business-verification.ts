/**
 * REMOVE THE PLACEHOLDER `verificationStatus` FROM BUSINESSES.
 *
 * `backfill-businesses.ts` wrote `verificationStatus: 'unverified'` onto every
 * business it created. That was meant to say "nobody has looked yet" — and it
 * reads that way — but it is indistinguishable from a real decision, because
 * nothing anywhere else ever writes that value on a business.
 *
 * That ambiguity has teeth now that the badge resolves from two documents. A
 * placeholder that looks like a decision is how an admin's approval gets
 * discarded: the badge reads the business, sees `unverified`, and never asks
 * the account where the real answer is.
 *
 * Removing it makes the field honest again:
 *
 *   absent → nobody has looked, and the account is consulted
 *   verified / pending / rejected → a real actor decided this
 *
 * Dry run by default. Pass `--apply` to write.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../src/firebase/server';

const APPLY = process.argv.includes('--apply');

async function main() {
  const snap = await db.collection('businesses').get();
  const toClear: { id: string; name: string; value: string }[] = [];
  const keep: { id: string; name: string; value: string }[] = [];

  for (const d of snap.docs) {
    const b = d.data() as any;
    const v = b.verificationStatus;
    if (v === undefined) continue;
    if (v === 'unverified') toClear.push({ id: d.id, name: b.name, value: v });
    else keep.push({ id: d.id, name: b.name, value: String(v) });
  }

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${toClear.length} to clear, ${keep.length} kept\n`);
  for (const c of toClear) console.log(`  clear  ${c.name.padEnd(24)} ${c.value}  (placeholder — no actor decided this)`);
  for (const k of keep) console.log(`  KEEP   ${k.name.padEnd(24)} ${k.value}  (a real decision — leaving it alone)`);

  if (!APPLY) {
    console.log('\nNothing written. Re-run with --apply.');
    return;
  }

  const batch = db.batch();
  for (const c of toClear) {
    batch.set(db.collection('businesses').doc(c.id), { verificationStatus: FieldValue.delete() }, { merge: true });
  }
  await batch.commit();
  console.log(`\nCleared ${toClear.length} placeholder value(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
