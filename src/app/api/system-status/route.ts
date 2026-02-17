
import { NextResponse } from 'next/server';
import { checkFirestoreHealth } from '@/lib/server-health';

type Status = 'operational' | 'degraded' | 'outage';

interface ServiceStatus {
  name: string;
  status: Status;
}

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

async function checkAiServices(): Promise<Status> {
    return checkExternalService('Genkit (AI)', ['GEMINI_API_KEY']);
}

async function checkLiveStreaming(): Promise<Status> {
    return checkExternalService('VideoSDK', ['VIDEOSDK_API_KEY', 'VIDEOSDK_SECRET_KEY']);
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
    const [
        firestore,
        live,
        ai,
        apiResponseTime,
    ] = await Promise.all([
        checkFirestoreHealth(),
        checkLiveStreaming(),
        checkAiServices(),
        getRealApiResponseTime(),
    ]);

    const services: ServiceStatus[] = [
      { name: 'API: Payments (Paystack/PayPal)', status: 'operational' },
      { name: 'Database (Firestore)', status: firestore },
      { name: 'Live Streaming (VideoSDK)', status: live },
      { name: 'AI Services (Genkit)', status: ai },
    ];

    return NextResponse.json({ services, apiResponseTime });
    
  } catch (error) {
    console.error("System Status API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
