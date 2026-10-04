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

  if (action === 'check') {
    const [profile, marker] = await Promise.all([profileRef.get(), adminsRef.get()]);
    console.log(JSON.stringify({
      uid,
      profileExists: profile.exists,
      userRole: profile.data()?.userRole ?? null,
      role: profile.data()?.role ?? null,
      adminsMarker: marker.exists,
    }, null, 2));
    return;
  }

  const promote = action === 'promote';
  const profileSnap = await profileRef.get();

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

  console.log(`${promote ? '✅ Promoted' : '⬇️  Demoted'} ${uid}: userProfile.userRole=${promote ? 'admin' : 'buyer'}${promote ? ' + admins marker' : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
