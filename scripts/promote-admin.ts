/**
 * One-shot admin utility: promote/demote/check a user's admin status.
 *
 * Usage:
 *   npx tsx scripts/promote-admin.ts check   <emailOrUid>
 *   npx tsx scripts/promote-admin.ts promote <emailOrUid>
 *   npx tsx scripts/promote-admin.ts demote  <emailOrUid>
 *
 * Writes userProfiles/{uid}.userRole = 'admin' (plus `role` for legacy
 * readers) and an admins/{uid} marker document, which the security rules
 * treat as an independent admin source of truth.
 *
 * Run with the service account: uses the same resolution as
 * src/firebase/server.ts (GOOGLE_APPLICATION_CREDENTIALS →
 * FIREBASE_SERVICE_ACCOUNT_JSON → ./service-account.json → ADC).
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';
import { pbIsAdmin, pbSetAdmin } from '../src/lib/pocketbase/admins';

function init() {
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

async function resolveUid(emailOrUid: string): Promise<string | null> {
  if (/^[a-zA-Z0-9]{28}$/.test(emailOrUid)) return emailOrUid;
  try {
    const user = await getAuth().getUserByEmail(emailOrUid);
    return user.uid;
  } catch {
    return null;
  }
}

async function main() {
  const [action, target] = process.argv.slice(2);
  if (!action || !target || !['check', 'promote', 'demote'].includes(action)) {
    console.error('Usage: npx tsx scripts/promote-admin.ts <check|promote|demote> <emailOrUid>');
    process.exit(1);
  }

  init();
  const db = getFirestore();
  const uid = await resolveUid(target);
  if (!uid) {
    console.error(`No Firebase Auth user found for "${target}".`);
    process.exit(1);
  }

  const profileRef = db.collection('userProfiles').doc(uid);
  const adminsRef = db.collection('admins').doc(uid);

  /*
   * Firestore is BEST-EFFORT here on purpose. This script exists for the
   * situation where the Firestore project is blocked/out of quota: the grant
   * that matters for the app's admin gates is the LOCAL PocketBase one, and
   * it must be written even when every Firestore call fails. An un-caught
   * Firestore error used to kill the script before the mirror was reached,
   * which is precisely when an admin needs it most.
   */
  if (action === 'check') {
    let profile: FirebaseFirestore.DocumentSnapshot | null = null;
    let marker: FirebaseFirestore.DocumentSnapshot | null = null;
    try {
      [profile, marker] = await Promise.all([profileRef.get(), adminsRef.get()]);
    } catch (error) {
      console.warn(`⚠ Firestore unreadable (${(error as Error).message.slice(0, 120)}) — showing the local grant only.`);
    }
    const localAdmin = await pbIsAdmin(uid);
    console.log(JSON.stringify({
      uid,
      profileExists: profile?.exists ?? null,
      userRole: profile?.data()?.userRole ?? null,
      role: profile?.data()?.role ?? null,
      adminsMarker: marker?.exists ?? null,
      localPocketBaseAdmin: localAdmin, // true / false / null = PocketBase not configured
    }, null, 2));
    return;
  }

  const promote = action === 'promote';
  let profileData: Record<string, unknown> = {};
  try {
    const profileSnap = await profileRef.get();
    profileData = profileSnap.data() ?? {};
    if (!profileSnap.exists) {
      // Create a minimal profile so the rules can resolve the role at all.
      await profileRef.set(
        {
          id: uid,
          uid,
          userRole: promote ? 'admin' : 'buyer',
          role: promote ? 'admin' : 'buyer',
          status: 'active',
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } else {
      await profileRef.update({
        userRole: promote ? 'admin' : 'buyer',
        role: promote ? 'admin' : 'buyer',
        updatedAt: new Date(),
      });
    }

    if (promote) {
      await adminsRef.set({ uid, grantedAt: new Date() }, { merge: true });
    } else {
      await adminsRef.delete().catch(() => undefined);
    }
  } catch (error) {
    console.warn(`⚠ Firestore write skipped (${(error as Error).message.slice(0, 120)}) — the local grant below still applies.`);
  }

  // The grant the app's admin gates read FIRST: the local (VPS) PocketBase
  // `admins` collection. Independent of Firestore — this is the write that
  // unlocks a blocked-Firestore production.
  const mirrored = await pbSetAdmin(uid, promote, {
    email: (profileData.email as string | undefined) ?? (target.includes('@') ? target : undefined),
    name: (profileData.fullName as string | undefined) ?? (profileData.displayName as string | undefined),
  });

  if (mirrored) {
    console.log(`${promote ? '✅ Promoted' : '⬇️  Demoted'} ${uid}: local PocketBase admin grant ${promote ? 'granted' : 'revoked'} — effective immediately on the VPS, no Firestore needed. (Firestore writes above are best-effort.)`);
  } else {
    console.error(`❌ Could not write the local grant. Set POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in the VPS .env, then re-run. Until then the only admin sources are Firestore (blocked) and the ADMIN_EMAILS env allowlist.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
