
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

function initializeAdminApp(): App {
  const existingApp = getApps().find(app => app.name === '[DEFAULT]');
  if (existingApp) {
    return existingApp;
  }

  // Use environment's default credentials in production (App Hosting)
  if (process.env.NODE_ENV === 'production') {
    return initializeApp({
      storageBucket: "studio-1725493862-5cb95.firebasestorage.app"
    });
  } 
  // Use service account key for local development
  else {
    let serviceAccount: any;
    try {
      serviceAccount = require('../../service-account.json');
    } catch (error) {
      console.error("Could not load service-account.json for local development:", error);
      throw new Error("Firebase Admin SDK could not be initialized for local development. Make sure 'service-account.json' is present in the root of your project.");
    }
    
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: "studio-1725493862-5cb95.firebasestorage.app"
    });
  }
}

const app = initializeAdminApp();
const db = getFirestore(app);
const auth = getAuth(app);
const bucket = getStorage(app).bucket();

export { db, auth, bucket };
