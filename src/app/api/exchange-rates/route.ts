
import { NextResponse } from 'next/server';
import placeholderData from '@/lib/placeholder-images.json';
import axios from 'axios';

/**
 * This is a server-side API route that acts as a secure proxy to fetch live currency exchange rates.
 * It is called by the CurrencyProvider on the client-side.
 * 
 * Why do we use an API route?
 * 1. Security: If an API key were needed, it would be kept securely on the server, not exposed in the browser.
 * 2. Reliability: It allows us to control the data flow and implement fallbacks.
 * 3. Control: We can add caching or logging here in the future without changing the client-side code.
 */
export async function GET() {
  try {
    // 1. Fetch REAL, LIVE data from the external exchange rate service using axios.
    const response = await axios.get(
      'https://api.exchangerate.host/latest?base=USD'
    );

    const data = response.data;

    // 2. Validate the response from the external service.
    // If the live data is malformed or the service is down, this prevents errors in our app.
    if (!data || data.success === false || !data.rates) {
      console.error('Invalid exchange API response, falling back to placeholder:', data);
      // 3a. If the live data fails, use the reliable backup data from the JSON file.
      return NextResponse.json({
        base: 'USD',
        rates: placeholderData.exchangeRates,
        updated: new Date().toISOString(),
        source: 'placeholder'
      });
    }

    // 3b. If the live data is good, send it to the client (the CurrencyProvider).
    return NextResponse.json({
      base: data.base || 'USD',
      rates: data.rates,
      updated: data.date || new Date().toISOString(),
      source: 'live'
    });

  } catch (error: any) {
    // 4. Catch any network errors during the fetch.
    console.error('Error fetching from exchangerate.host, falling back to placeholder:', error.message);
    // If there's an error, gracefully fall back to our static placeholder data.
    return NextResponse.json({
      base: 'USD',
      rates: placeholderData.exchangeRates,
      updated: new Date().toISOString(),
      source: 'placeholder'
    });
  }
}
