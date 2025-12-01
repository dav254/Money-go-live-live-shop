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

function createAdminApp(): App | null {
    if (serviceAccount) {
        const existingApp = getApps().find(app => app.name === appName);
        if (existingApp) {
            return existingApp;
        }
        return initializeApp({
            credential: cert(serviceAccount)
        }, appName);
    }
    console.error("Firebase Admin SDK could not be initialized because service-account.json is missing or invalid.");
    return null;
}

const app = createAdminApp();
const db = app ? getFirestore(app) : null;

export { db };
