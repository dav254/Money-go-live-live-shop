
import { NextResponse } from 'next/server';
import { healthCheck as paymentsHealthCheck } from '../create-payment-intent/route';
import { healthCheck as followHealthCheck } from '../follow/route';
import { healthCheck as uploadHealthCheck } from '../upload/route';
import { checkFirestoreHealth } from '@/lib/server-health';


type Status = 'operational' | 'degraded' | 'outage';

interface ServiceStatus {
  name: string;
  status: Status;
}

// --- Real Health Checks ---


// A simple check for external services we can't truly ping.
// This confirms our environment variables are set up.
async function checkExternalService(name: string, envVars: string[]): Promise<Status> {
    const isConfigured = envVars.every(v => !!process.env[v]);
    if (isConfigured) {
        return 'operational';
    }
    console.warn(`${name} is not configured. Missing environment variables.`);
    return 'degraded';
}

// This is now a real check for the AI service configuration.
async function checkAiServices(): Promise<Status> {
    return checkExternalService('Genkit (AI)', ['GEMINI_API_KEY']);
}

// This is now a real check for the Live Streaming service configuration.
async function checkLiveStreaming(): Promise<Status> {
    // In a real scenario, you'd check for Mux keys or other live streaming provider keys
    return checkExternalService('Live Streaming (Mux)', ['MUX_TOKEN_ID', 'MUX_TOKEN_SECRET']);
}

// Measures the actual API response time by performing a quick database health check.
async function getRealApiResponseTime(): Promise<number> {
    const startTime = Date.now();
    await checkFirestoreHealth();
    const endTime = Date.now();
    return endTime - startTime;
}


export async function GET(request: Request) {
  try {
    // Perform all health checks in parallel for speed
    const [
        payments,
        follow,
        upload,
        firestore,
        live,
        ai,
        apiResponseTime,
    ] = await Promise.all([
        paymentsHealthCheck(),
        followHealthCheck(),
        uploadHealthCheck(),
        checkFirestoreHealth(),
        checkLiveStreaming(),
        checkAiServices(),
        getRealApiResponseTime(),
    ]);

    const services: ServiceStatus[] = [
      { name: 'API: Payments', status: payments.status as Status },
      { name: 'API: User Follows', status: follow.status as Status },
      { name: 'API: Image Uploads', status: upload.status as Status },
      { name: 'Database (Firestore)', status: firestore },
      { name: 'Live Streaming (Mux)', status: live },
      { name: 'AI Services (Genkit)', status: ai },
    ];

    return NextResponse.json({ services, apiResponseTime });
    
  } catch (error) {
    console.error("System Status API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
