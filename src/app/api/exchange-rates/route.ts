import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(
      'https://api.exchangerate.host/latest?base=USD'
    );

    if (!res.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await res.json();

    // The error was that the provider was expecting the rates object directly.
    // This now returns the full expected payload.
    return NextResponse.json({
      base: data.base,
      rates: data.rates,
      updated: data.date,
    });
  } catch (error) {
    console.error("Error in /api/exchange-rates:", error);
    return NextResponse.json(
      { error: 'Unable to fetch exchange rates from the external provider.' },
      { status: 500 }
    );
  }
}
