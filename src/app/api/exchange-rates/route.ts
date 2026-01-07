
import { NextResponse } from 'next/server';
import placeholderData from '@/lib/placeholder-images.json';
import axios from 'axios';

export async function GET() {
  try {
    const response = await axios.get(
      'https://api.exchangerate.host/latest?base=USD'
    );

    const data = response.data;

    // HARD validation
    if (!data || data.success === false || !data.rates) {
      console.error('Invalid exchange API response, falling back to placeholder:', data);
      return NextResponse.json({
        base: 'USD',
        rates: placeholderData.exchangeRates,
        updated: new Date().toISOString(),
        source: 'placeholder'
      });
    }

    return NextResponse.json({
      base: data.base || 'USD',
      rates: data.rates,
      updated: data.date || new Date().toISOString(),
      source: 'live'
    });

  } catch (error: any) {
    console.error('Error fetching from exchangerate.host, falling back to placeholder:', error.message);
    return NextResponse.json({
      base: 'USD',
      rates: placeholderData.exchangeRates,
      updated: new Date().toISOString(),
      source: 'placeholder'
    });
  }
}
