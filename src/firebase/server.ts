// This file is designated for server-side Firebase initialization.
// It is crucial that this file does not contain the 'use client';' directive.

import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from './admin';

// Initialize the app using the centralized function
initializeAdminApp();

// Get the Firestore instance from the initialized app
const db = getFirestore();

export { db };
