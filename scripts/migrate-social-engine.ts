/**
 * Copy the two Social Engine sections from Firestore to PocketBase (VPS).
 *
 * SCOPE — exactly these five collections:
 *   growthPosts            → growth_posts
 *   social_connections     → social_engine_connections
 *   social_engine_tests    → social_engine_tests
 *   social_engine_meta     → social_engine_meta
 *   social_engine_audit    → social_engine_audit
 *
 * PocketBase is now the PRIMARY store for both sections; Firestore stays as a
 * best-effort mirror. This script performs the one-time copy so the admin
 * queue and the readiness dashboard are not empty after the switch.
 *
 * SAFETY RULES BAKED IN
 *   • Dry-run is the DEFAULT. Nothing is written unless you pass `--apply`.
 *   • Prints COUNTS ONLY — never tokens, captions, emails or any document body.
 *     Connection documents are copied with their AES-256-GCM sealed payload
 *     untouched; the script never decrypts anything.
 *   • Idempotent: every row is keyed by its Firestore id (`fsId`), so a second
 *     `--apply` updates the same PocketBase record instead of duplicating it.
 *   • `--verify` reports Firestore vs PocketBase counts only.
 *   • Firestore is never written or deleted. No data is removed anywhere.
 *
 * USAGE (run on the VPS, in /root/app, with the app's env loaded):
 *   npx -y tsx scripts/migrate-social-engine.ts             # dry-run
 *   npx -y tsx scripts/migrate-social-engine.ts --apply
 *   npx -y tsx scripts/migrate-social-engine.ts --verify
 *
 * Requires POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD
 * (the same names the app uses). Aborts without them.
 *
 * Firebase credentials resolve exactly like src/firebase/server.ts
 * (GOOGLE_APPLICATION_CREDENTIALS → FIREBASE_SERVICE_ACCOUNT_JSON →
 * ./service-account.json → ADC).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

import { pocketBaseEnabled } from '../src/lib/pocketbase/server';
import {
  pbGetGrowthPost,
  pbWriteGrowthPost,
  GROWTH_POSTS_PB_COLLECTION,
} from '../src/lib/pocketbase/growth-posts';
import {
  pbSocialGet,
  pbSocialWrite,
  SOCIAL_ENGINE_PB_COLLECTIONS,
  type SocialEnginePbCollection,
} from '../src/lib/pocketbase/social-engine';

interface Section {
  label: string;
  firestore: string;
  pocketbase: string;
  write: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  read: (id: string) => Promise<unknown | null>;
}

const PAGE = 200;

function initFirebase() {
  if (getApps().length > 0) return;
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const localPath = path.join(process.cwd(), 'service-account.json');
  if (adcPath && fs.existsSync(adcPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(adcPath, 'utf8'))) });
  } else if (inline) {
    initializeApp({ credential: cert(JSON.parse(inline)) });
  } else if (fs.existsSync(localPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(localPath, 'utf8'))) });
  } else {
    initializeApp(); // ADC fallback
  }
}

const social = (collection: SocialEnginePbCollection) =>
  async (id: string, data: Record<string, unknown>) => pbSocialWrite(collection, id, data);

const SECTIONS: Section[] = [
  {
    label: 'growthPosts',
    firestore: 'growthPosts',
    pocketbase: GROWTH_POSTS_PB_COLLECTION,
    write: (id, data) => pbWriteGrowthPost(id, data),
    read: (id) => pbGetGrowthPost(id),
  },
  {
    label: 'social_connections',
    firestore: 'social_connections',
    pocketbase: SOCIAL_ENGINE_PB_COLLECTIONS.connections,
    write: social(SOCIAL_ENGINE_PB_COLLECTIONS.connections),
    read: (id) => pbSocialGet(SOCIAL_ENGINE_PB_COLLECTIONS.connections, id),
  },
  {
    label: 'social_engine_tests',
    firestore: 'social_engine_tests',
    pocketbase: SOCIAL_ENGINE_PB_COLLECTIONS.tests,
    write: social(SOCIAL_ENGINE_PB_COLLECTIONS.tests),
    read: (id) => pbSocialGet(SOCIAL_ENGINE_PB_COLLECTIONS.tests, id),
  },
  {
    label: 'social_engine_meta',
    firestore: 'social_engine_meta',
    pocketbase: SOCIAL_ENGINE_PB_COLLECTIONS.meta,
    write: social(SOCIAL_ENGINE_PB_COLLECTIONS.meta),
    read: (id) => pbSocialGet(SOCIAL_ENGINE_PB_COLLECTIONS.meta, id),
  },
  {
    label: 'social_engine_audit',
    firestore: 'social_engine_audit',
    pocketbase: SOCIAL_ENGINE_PB_COLLECTIONS.audit,
    write: social(SOCIAL_ENGINE_PB_COLLECTIONS.audit),
    read: (id) => pbSocialGet(SOCIAL_ENGINE_PB_COLLECTIONS.audit, id),
  },
];

/** Reads a whole collection, page by page (ids only leave this function). */
async function readAll(
  db: Firestore,
  name: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  let last: string | null = null;
  for (;;) {
    let q = db.collection(name).orderBy('__name__').limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    snap.forEach((doc) => {
      out.push({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> });
    });
    if (snap.size < PAGE) break;
    last = snap.docs[snap.docs.length - 1]?.id ?? null;
    if (!last) break;
  }
  return out;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const verify = args.has('--verify');
  const explain = args.has('--explain');

  if (!pocketBaseEnabled()) {
    console.error(
      'PocketBase is not configured. Set POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD first.',
    );
    process.exitCode = 1;
    return;
  }
  if (explain) {
    for (const s of SECTIONS) console.log(`${s.firestore} → ${s.pocketbase}`);
    return;
  }

  initFirebase();
  const db = getFirestore();

  console.log(`Social Engine → PocketBase copy — mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('Counts only. No document bodies, tokens or captions are printed.\n');

  for (const section of SECTIONS) {
    const rows = await readAll(db, section.firestore);
    let written = 0;
    let already = 0;
    let failed = 0;

    if (verify || !apply) {
      // Dry-run / verify: count how many rows the destination already has.
      for (const row of rows) {
        try {
          const existing = await section.read(row.id);
          if (existing) already += 1;
        } catch {
          // Unreadable destination row: report it as not copied, never throw
          // the whole report away.
          failed += 1;
        }
      }
    } else {
      for (const row of rows) {
        try {
          await section.write(row.id, row.data);
          written += 1;
        } catch {
          failed += 1;
        }
      }
    }

    console.log(
      `${section.label.padEnd(22)} firestore=${String(rows.length).padStart(5)}` +
        (apply && !verify
          ? `  written=${written}  failed=${failed}`
          : `  already_in_pocketbase=${already}  unreadable=${failed}`),
    );
  }

  console.log(
    apply
      ? '\nDone. Firestore was not modified. Re-running --apply is safe (idempotent by fsId).'
      : '\nDry-run only. Re-run with --apply to copy these rows into PocketBase.',
  );
  if (!apply) {
    console.log('After --apply, run with --verify to confirm destination counts.');
  }
}

main().catch((error) => {
  // Static message only — never a document body.
  console.error('Migration failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
