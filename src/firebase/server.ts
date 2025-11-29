// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the 'use client';' directive.

import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

let serviceAccount: any;
try {
  // Construct a reliable, absolute path to the service-account.json file
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  // Read the file synchronously and parse it
  const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
  serviceAccount = JSON.parse(serviceAccountFile);
} catch (e) {
  console.error("Failed to load or parse service-account.json. Make sure the file exists in the project root and is valid JSON.");
  // If the file doesn't exist, we can't initialize the admin app.
}

const appName = `firebase-admin-app:${process.env.VERCEL_DEPLOYMENT_ID || 'local'}`;

let app: App | undefined;

if (!getApps().some(existingApp => existingApp.name === appName)) {
  if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount)
    }, appName);
  } else {
    // Cannot initialize without service account
    console.error("Firebase Admin SDK could not be initialized because service-account.json is missing or invalid.");
  }
} else {
  app = getApp(appName);
}

// Conditionally export db only if the app was initialized
const db = app ? getFirestore(app) : null;

export { db };
