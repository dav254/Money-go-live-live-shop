
'use server';

import { config } from 'dotenv';
config();

// Firebase Admin SDK is no longer initialized here.
// It is initialized on-demand in flows that need it or via `src/firebase/server.ts`.

import '@/ai/flows/suggest-daily-content.ts';
import '@/ai/flows/generate-product-description.ts';
import '@/ai/flows/generate-deal-suggestion.ts';
import '@/ai/flows/generate-video-from-image.ts';
import '@/ai/flows/live-selling-copilot.ts';
import '@/ai/flows/generate-video-from-text.ts';
import '@/ai/flows/generate-caption.ts';
