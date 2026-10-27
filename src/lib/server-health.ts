
// This file is designated for server-side health checks.
// It is crucial that this file does not contain the 'use client';' directive.
import { db } from '@/firebase/server';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary config mirrors the signature route's setup; credentials are read
// from env at call time, never logged.
cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

type Status = 'operational' | 'degraded' | 'outage';

/**
 * Checks connectivity to Firestore by performing a simple, inexpensive read.
 * This function should only be imported and used in server-side environments (e.g., API routes).
 * Uses the Firebase Admin SDK (`db` from @/firebase/server) — do NOT import from 'firebase/firestore' here,
 * as that is the client SDK and is incompatible with the Admin Firestore instance.
 */
export async function checkFirestoreHealth(): Promise<Status> {
    try {
        const healthCheckRef = db.collection('userProfiles');
        // Perform a very small query that is likely to be cached and inexpensive.
        await healthCheckRef.limit(1).get();
        return 'operational';
    } catch (error) {
        console.error("Firestore health check failed:", error);
        return 'outage';
    }
}

/**
 * Health check node for Cloudinary connectivity.
 * Lives here (not in `app/api/upload/route.ts`) because Next.js route modules may
 * only export standard HTTP handlers — extra exports fail route type validation.
 */
export async function cloudinaryHealthCheck(): Promise<{ status: Status; message?: string }> {
    const config = cloudinary.config();
    if (config.cloud_name && config.api_key && config.api_secret) {
        return { status: 'operational' };
    }
    return { status: 'outage', message: 'Cloudinary credentials missing.' };
}
