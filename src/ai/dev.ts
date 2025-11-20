'use server';

import { config } from 'dotenv';
config();

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import * as serviceAccount from '../../../service-account.json';

// Initialize Firebase Admin SDK if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as any),
  });
}


import '@/ai/flows/suggest-daily-content.ts';
import '@/ai/flows/generate-product-description.ts';
import '@/ai/flows/is-admin.ts';
