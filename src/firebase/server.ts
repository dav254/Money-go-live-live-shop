
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves the service account credential for environments WITHOUT automatic ADC
 * (e.g. a self-hosted VPS, Docker, or any non-Google host).
 *
 * Resolution order:
 *  1. GOOGLE_APPLICATION_CREDENTIALS  -> path to a service account JSON file (standard ADC mechanism)
 *  2. FIREBASE_SERVICE_ACCOUNT_JSON   -> the full service account JSON as a string (handy for VPS env vars)
 *  3. ./service-account.json          -> local dev convenience file (gitignored — do NOT commit real keys)
 *  4. Fall back to ADC (works on Firebase App Hosting / Cloud Run / GCE)
 */
function loadCredential(): { credential?: ReturnType<typeof cert>; usingAdc: boolean } {
  // 0. Leading whitespace or accidental quoting from a pasted env var is the
  // single most common way server calls die with "Internal Server Error" —
  // trim it and strip wrapping quotes so Firebase Admin still initializes.
  for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_SERVICE_ACCOUNT_JSON']) {
    const v = process.env[name];
    if (typeof v === 'string' && v.trim() !== v) process.env[name] = v.trim();
  }
  const inlineRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (
    typeof inlineRaw === 'string' &&
    inlineRaw.length > 1 &&
    (inlineRaw.startsWith('"') || inlineRaw.startsWith("'")) &&
    inlineRaw.slice(1).endsWith(inlineRaw[0])
  ) {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = inlineRaw.slice(1, -1);
  }

  // 1. Standard ADC file path
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (adcPath && fs.existsSync(adcPath)) {
    return { credential: cert(JSON.parse(fs.readFileSync(adcPath, 'utf8'))), usingAdc: false };
  }

  // 2. Inline JSON env var (recommended for VPS: paste the JSON into an env var)
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      return { credential: cert(JSON.parse(inlineJson)), usingAdc: false };
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON — falling back.');
    }
  }

  // 3. Local dev / VPS file at the project root (runtime read — safe under webpack bundling)
  try {
    const localPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(localPath)) {
      return { credential: cert(JSON.parse(fs.readFileSync(localPath, 'utf8'))), usingAdc: false };
    }
  } catch {
    // ignore and fall through to ADC
  }

  // 4. No file anywhere — rely on Application Default Credentials (Firebase App Hosting, Cloud Run, GCE)
  return { usingAdc: true };
}

function initializeAdminApp(): App {
  const existingApp = getApps().find(app => app.name === '[DEFAULT]');
  if (existingApp) {
    return existingApp;
  }

  const { credential, usingAdc } = loadCredential();
  const options: Parameters<typeof initializeApp>[0] = {
    };

  if (!usingAdc && credential) {
    options.credential = credential;
  } else if (process.env.NODE_ENV !== 'production') {
    // In dev, missing credentials will almost certainly break admin calls — warn loudly.
    console.warn(
      '[Firebase Admin] No service account found (GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or ./service-account.json). '
      + 'Falling back to Application Default Credentials — admin calls will fail if none are available.'
    );
  }

  return initializeApp(options);
}

const app = initializeAdminApp();
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = undefined;

export { db, auth };
