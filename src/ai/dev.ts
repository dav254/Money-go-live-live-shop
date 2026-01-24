'use server';

import { config } from 'dotenv';
config();

// Firebase Admin SDK is no longer initialized here globally.
// It will be initialized within the specific flows/actions that need it
// by calling initializeAdminApp().

import '@/ai/flows/suggest-daily-content.ts';
import '@/ai/flows/generate-product-description.ts';
import '@/ai/flows/generate-deal-suggestion.ts';
import '@/ai/flows/generate-video-from-image.ts';
import '@/ai/flows/live-selling-copilot.ts';
import '@/ai/flows/generate-video-from-text.ts';
import '@/ai/flows/admin-chat-flow.ts';
import '@/ai/flows/publish-video.ts';
import '@/ai/flows/generate-enhanced-video.ts';
import '@/ai/flows/generate-ad-kit.ts';
