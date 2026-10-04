
// This file is designated for server-side health checks.
// It is crucial that this file does not contain the 'use client';' directive.
import { db } from '@/firebase/server';

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
