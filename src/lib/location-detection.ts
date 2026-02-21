
'use client';

/**
 * @fileOverview Utility for detecting buyer location via GPS or IP fallback.
 */

export interface UserLocation {
    country: string;
    city: string;
    region?: string;
    method: 'gps' | 'ip';
}

/**
 * Attempts to detect the user's location using browser geolocation first,
 * falling back to IP detection.
 */
export async function detectLocation(): Promise<UserLocation> {
    // 1. Try GPS
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            
            const { latitude, longitude } = position.coords;
            
            // We use a free reverse geocoding fallback if no API key is set
            // For production, you would use Google Maps or OpenCage here.
            // For now, we fall back to IP if we don't have a reverse geocoding key
            return await detectByIP(); 
        } catch (err) {
            console.warn("GPS detection failed or denied, falling back to IP.");
        }
    }

    return await detectByIP();
}

/**
 * Detects location using ipapi.co (Free tier supported).
 */
export async function detectByIP(): Promise<UserLocation> {
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        
        return {
            country: data.country_name || 'Kenya',
            city: data.city || 'Nairobi',
            region: data.region || 'Nairobi',
            method: 'ip'
        };
    } catch (err) {
        console.error("IP detection failed:", err);
        return {
            country: 'Kenya',
            city: 'Nairobi',
            region: 'Nairobi',
            method: 'ip'
        };
    }
}

/**
 * Saves location to local storage for persistence across the session.
 */
export function saveLocationToStorage(location: UserLocation) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('go_earn_user_location', JSON.stringify(location));
    }
}

/**
 * Retrieves location from local storage.
 */
export function getLocationFromStorage(): UserLocation | null {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('go_earn_user_location');
        return stored ? JSON.parse(stored) : null;
    }
    return null;
}
