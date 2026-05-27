import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({ 
        message: 'Simulation endpoint is disabled. Use live payment gateways for all transactions.' 
    }, { status: 410 });
}
