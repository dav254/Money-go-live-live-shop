// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the 'use client';' directive.

import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// Construct an absolute path to the service account key
// process.cwd() gives the root of the project.
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (e) {
  console.error("Failed to load service-account.json. Make sure the file exists in the project root.");
  // If the file doesn't exist, we can't initialize the admin app.
  // We'll let the health check fail downstream.
}


const appName = `firebase-admin-app:${process.env.VERCEL_DEPLOYMENT_ID || 'local'}`;

let app: App;

if (!getApps().some(existingApp => existingApp.name === appName)) {
  if (serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount)
    }, appName);
  } else {
    // Cannot initialize without service account
    console.error("Firebase Admin SDK could not be initialized because service-account.json is missing.");
  }
} else {
  app = getApp(appName);
}

// Conditionally export db only if the app was initialized
// @ts-ignore
const db = app ? getFirestore(app) : null;

export { db };
