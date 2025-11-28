// src/firebase/admin.ts
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
    console.error("service-account.json not found at project root.");
  }
} catch (e) {
    console.error("Failed to load or parse service-account.json.", e);
}


const appName = 'firebase-admin-app';

export function initializeAdminApp(): App {
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return existingApp;
  }

  if (!serviceAccount) {
      throw new Error("Firebase Admin SDK could not be initialized because service-account.json is missing or invalid.");
  }

  const newApp = initializeApp({
    credential: cert(serviceAccount),
  }, appName);

  return newApp;
}
