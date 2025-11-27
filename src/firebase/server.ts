// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the ''use client';' directive.

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// IMPORTANT: The service-account.json file is gitignored.
// You must download your own from the Firebase console and place it in the root directory.
const serviceAccount = require(path.resolve(process.cwd(), 'service-account.json'));


const appName = 'firebase-admin-app-server';

let db: FirebaseFirestore.Firestore;

if (!getApps().some(app => app.name === appName)) {
  const newApp = initializeApp({
    credential: cert(serviceAccount),
  }, appName);
  db = getFirestore(newApp);
} else {
  db = getFirestore(getApp(appName));
}


export { db };
