// src/firebase/admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import * as path from 'path';
import * as fs from 'fs';

let serviceAccount: any;
try {
  // Use a more robust path resolution
  const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccountFile = fs.readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(serviceAccountFile);
  } else {
    // This is not an error in all environments (e.g., client-side), so a warning is better.
    console.warn("service-account.json not found at project root. This is expected on the client side but will cause issues on the server.");
  }
} catch (e) {
    console.error("Failed to load or parse service-account.json.", e);
}


// Use a unique name for the app to avoid conflicts.
const appName = 'firebase-admin-app';

/**
 * A robust, idempotent function to initialize the Firebase Admin SDK.
 * It checks if the app is already initialized before attempting to create a new one.
 * This is the ONLY function that should be used for server-side initialization.
 */
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
