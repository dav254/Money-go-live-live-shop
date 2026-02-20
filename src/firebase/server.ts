// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the 'use client';' directive.

import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import * as path from 'path';
import * as fs from 'fs';

let serviceAccount: any;
try {
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountFile);
  } else {
    console.warn("service-account.json not found. Server-side Firebase features will be disabled.");
  }
} catch (e) {
    console.error("Failed to load or parse service-account.json.", e);
}


function initializeAdminApp(): App {
  const existingApp = getApps().find(app => app.name === '[DEFAULT]');
  if (existingApp) {
    return existingApp;
  }

  if (!serviceAccount) {
      throw new Error("Firebase Admin SDK could not be initialized because service-account.json is missing or invalid.");
  }

  return initializeApp({
    credential: cert(serviceAccount),
    storageBucket: "studio-1725493862-5cb95.firebasestorage.app"
  });
}

const app = initializeAdminApp();
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();

export { db, auth, bucket };
