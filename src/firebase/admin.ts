
// src/firebase/admin.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

// IMPORTANT: The service-account.json file is gitignored. 
// You must download your own from the Firebase console and place it in the root directory.
const serviceAccount = require('../../service-account.json');

const appName = 'firebase-admin-app';

export function initializeAdminApp(): App {
  const existingApp = getApps().find(app => app.name === appName);
  if (existingApp) {
    return existingApp;
  }

  const newApp = initializeApp({
    credential: cert(serviceAccount),
  }, appName);

  return newApp;
}
