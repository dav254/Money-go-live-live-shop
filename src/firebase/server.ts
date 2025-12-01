// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the 'use client';' directive.

import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from './admin';

// Get the Firestore instance from the initialized app.
// Note: initializeAdminApp is idempotent and will not re-initialize if already done.
const app = initializeAdminApp();
const db = getFirestore(app);

export { db };
