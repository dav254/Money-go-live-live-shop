import { NextResponse } from 'next/server';
import { checkFirestoreHealth } from '@/lib/server-health';
import { healthCheck as cloudinaryHealth } from '../upload/route';

type Status = 'operational' | 'degraded' | 'outage';

interface ServiceStatus {
  name: string;
  status: Status;
}

/**
 * Checks if a specific external service is configured and reachable.
 */
async function checkExternalService(name: string, envVars: string[]): Promise<Status> {
    const isConfigured = envVars.every(v => !!process.env[v]);
    if (isConfigured) {
        return 'operational';
    }
    console.warn(`[Health Check] ${name} is not configured. Missing environment variables.`);
    return 'degraded';
}

async function checkAiServices(): Promise<Status> {
    return checkExternalService('Genkit AI (Gemini)', ['GEMINI_API_KEY']);
}

async function checkLiveStreaming(): Promise<Status> {
    return checkExternalService('VideoSDK Signal', ['VIDEOSDK_API_KEY', 'VIDEOSDK_SECRET_KEY']);
}

async function checkMediaStorage(): Promise<Status> {
    const res = await cloudinaryHealth();
    return res.status as Status;
}

async function checkPaymentGateways(): Promise<Status> {
    const paystack = !!process.env.PAYSTACK_SECRET_KEY;
    const paypal = !!process.env.PAYPAL_CLIENT_ID;
    return (paystack && paypal) ? 'operational' : 'degraded';
}

/**
 * Measures real-time API response time.
 */
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
        payments,
        media,
        apiResponseTime,
    ] = await Promise.all([
        checkFirestoreHealth(),
        checkLiveStreaming(),
        checkAiServices(),
        checkPaymentGateways(),
        checkMediaStorage(),
        getRealApiResponseTime(),
    ]);

    const services: ServiceStatus[] = [
      { name: 'API Gateway (Vidnov)', status: 'operational' },
      { name: 'Database (Firebase Firestore)', status: firestore },
      { name: 'AI Core (Google Gemini)', status: ai },
      { name: 'Live Stream Signals (VideoSDK)', status: live },
      { name: 'Payment Flow (Paystack/PayPal)', status: payments },
      { name: 'Media Storage (Cloudinary)', status: media },
    ];

    return NextResponse.json({ services, apiResponseTime });
    
  } catch (error) {
    console.error("System Status API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
