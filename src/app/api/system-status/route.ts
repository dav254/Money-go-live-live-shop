
import { NextResponse } from 'next/server';

type Status = 'operational' | 'degraded' | 'outage';

interface ServiceStatus {
  name: string;
  status: Status;
}

// This is where the simulation logic lives.
// A backend engineer would replace this with real health checks.
function getSimulatedStatus(): Status {
    const random = Math.random();
    if (random < 0.9) return 'operational';
    if (random < 0.97) return 'degraded';
    return 'outage';
}

function getSimulatedApiResponseTime(): number {
    const baseResponse = 50 + Math.random() * 100; // 50-150ms
    const spike = Math.random() > 0.95 ? Math.random() * 200 : 0; // 5% chance of a spike
    return Math.floor(baseResponse + spike);
}

export async function GET(request: Request) {
  try {
    // Now we simulate status for each major API endpoint
    const services: ServiceStatus[] = [
      { name: 'API: Payments', status: getSimulatedStatus() },
      { name: 'API: User Follows', status: getSimulatedStatus() },
      { name: 'API: Image Uploads', status: getSimulatedStatus() },
      { name: 'Database (Firestore)', status: getSimulatedStatus() },
      { name: 'Live Streaming (Mux)', status: getSimulatedStatus() },
      { name: 'AI Services (Genkit)', status: getSimulatedStatus() },
    ];
    
    const apiResponseTime = getSimulatedApiResponseTime();

    return NextResponse.json({ services, apiResponseTime });
    
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
