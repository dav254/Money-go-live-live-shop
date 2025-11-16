
// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the ''use client';' directive.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Initialize the Firebase app if it hasn't been already.
// This is safe to run on the server.
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

// Export the initialized Firestore database instance for use in server components.
const db = getFirestore(getApp());

export { db };
