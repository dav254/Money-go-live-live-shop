'use server';

import { config } from 'dotenv';
config();

// Firebase Admin SDK is now initialized within the flows that need it.
// This ensures it works in both dev and production environments.

import '@/ai/flows/suggest-daily-content.ts';
import '@/ai/flows/generate-product-description.ts';
import '@/ai/flows/is-admin.ts';
