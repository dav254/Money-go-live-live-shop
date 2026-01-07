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

    return NextResponse.json({
      base: data.base,
      rates: data.rates,
      updated: data.date,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Unable to fetch exchange rates' },
      { status: 500 }
    );
  }
}
