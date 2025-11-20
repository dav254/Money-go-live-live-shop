
'use server';

import { config } from 'dotenv';
config();

// Firebase Admin SDK is no longer initialized here.
// It will be initialized within the specific flows that need it to ensure
// it works in all environments.

import '@/ai/flows/suggest-daily-content.ts';
import '@/ai/flows/generate-product-description.ts';
