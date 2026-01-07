import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(
      'https://api.exchangerate.host/latest?base=USD'
    );

    if (!res.ok) {
      throw new Error('Failed to fetch exchange rates from external provider');
    }

    const data = await res.json();

    // HARD validation to ensure the data structure is what we expect.
    if (!data || data.success === false || !data.rates) {
      console.error('Invalid exchange API response:', data);
      return NextResponse.json(
        { error: 'Invalid or failed response from exchange rate service' },
        { status: 502 } // Bad Gateway
      );
    }

    // Return the data in a consistent format for our client.
    return NextResponse.json({
      base: data.base || 'USD',
      rates: data.rates,
      updated: data.date || new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in /api/exchange-rates:', error.message);
    return NextResponse.json(
      { error: 'Unable to fetch exchange rates', details: error.message },
      { status: 500 }
    );
  }
}
