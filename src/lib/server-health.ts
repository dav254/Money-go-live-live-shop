// This file is designated for server-side health checks.
// It is crucial that this file does not contain the 'use client';' directive.
import { db } from '@/firebase/server';
import { collection, getDocs, limit, query } from 'firebase/firestore';

type Status = 'operational' | 'degraded' | 'outage';

/**
 * Checks connectivity to Firestore by performing a simple, inexpensive read.
 * This function should only be imported and used in server-side environments (e.g., API routes).
 */
export async function checkFirestoreHealth(): Promise<Status> {
    try {
        const healthCheckRef = collection(db, 'userProfiles');
        // Perform a very small query that is likely to be cached and inexpensive.
        await getDocs(query(healthCheckRef, limit(1)));
        return 'operational';
    } catch (error) {
        console.error("Firestore health check failed:", error);
        return 'outage';
    }
}
