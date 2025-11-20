import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-daily-content.ts';
import '@/ai/flows/generate-product-description.ts';
import '@/ai/flows/is-admin.ts';
