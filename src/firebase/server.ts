// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the ''use client';' directive.

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// IMPORTANT: The service-account.json file is gitignored.
// You must download your own from the Firebase console and place it in the root directory.
const serviceAccount = require('../../service-account.json');


const appName = 'firebase-admin-app-server';

let db: FirebaseFirestore.Firestore;

// Correctly initialize the admin app if it doesn't already exist.
if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

// Get the initialized Firestore instance.
db = getFirestore();


export { db };
