import { NextResponse } from 'next/server';
import placeholderData from '@/lib/placeholder-images.json';

export async function GET() {
  try {
    const res = await fetch(
      'https://api.exchangerate.host/latest?base=USD'
    );

    if (!res.ok) {
      // If the API call fails, log it but fall back to placeholder data.
      console.error(`External exchange rate API failed with status: ${res.status}`);
      return NextResponse.json({
        base: 'USD',
        rates: placeholderData.exchangeRates,
        updated: new Date().toISOString(),
        source: 'placeholder'
      });
    }

    const data = await res.json();

    // Validate the live data.
    if (!data || data.success === false || !data.rates) {
      console.warn('Invalid live exchange rate data, falling back to placeholders.', data);
      return NextResponse.json({
        base: 'USD',
        rates: placeholderData.exchangeRates,
        updated: new Date().toISOString(),
        source: 'placeholder'
      });
    }

    // If live data is valid, return it.
    return NextResponse.json({
      base: data.base || 'USD',
      rates: data.rates,
      updated: data.date || new Date().toISOString(),
      source: 'live'
    });

  } catch (error: any) {
    // If any other error occurs (e.g., network issue), fall back to placeholders.
    console.error('Error in /api/exchange-rates, falling back to placeholders:', error.message);
    return NextResponse.json({
      base: 'USD',
      rates: placeholderData.exchangeRates,
      updated: new Date().toISOString(),
      source: 'placeholder'
    });
  }
}
