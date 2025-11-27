// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the 'use client';' directive.

import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// IMPORTANT: This file reads the service account key from the project root.
const serviceAccount = require('../../service-account.json');

const appName = `firebase-admin-app:${process.env.VERCEL_DEPLOYMENT_ID || 'local'}`;

let app: App;
if (getApps().some(existingApp => existingApp.name === appName)) {
  app = getApp(appName);
} else {
  app = initializeApp({
    credential: cert(serviceAccount)
  }, appName);
}

const db = getFirestore(app);

export { db };
