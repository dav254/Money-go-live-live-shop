
import { NextResponse } from 'next/server';

// In a real-world scenario, this would be an external API call.
// We are mocking it here for demonstration purposes.
// The API key would be stored in .env.local as process.env.EXCHANGE_RATE_API_KEY
const mockApiRates = {
    "USD": 1,
    "CAD": 1.37,
    "MXN": 17.00,
    "EUR": 0.92,
    "GBP": 0.79,
    "CHF": 0.90,
    "SEK": 10.50,
    "NOK": 10.60,
    "DKK": 6.85,
    "PLN": 3.95,
    "CZK": 23.00,
    "HUF": 360.00,
    "RUB": 90.00,
    "TRY": 32.50,
    "CNY": 7.25,
    "JPY": 157.00,
    "INR": 83.50,
    "KRW": 1375.00,
    "SGD": 1.35,
    "HKD": 7.80,
    "AED": 3.67,
    "SAR": 3.75,
    "QAR": 3.64,
    "IDR": 16200.00,
    "MYR": 4.70,
    "PHP": 58.70,
    "THB": 36.70,
    "VND": 25400.00,
    "BRL": 5.25,
    "ARS": 900.00,
    "CLP": 925.00,
    "COP": 3900.00,
    "PEN": 3.75,
    "NGN": 1480.00,
    "KES": 128.50,
    "GHS": 14.90,
    "ZAR": 18.25,
    "EGP": 47.50,
    "UGX": 3750.00,
    "TZS": 2580.00,
    "ETB": 57.00,
    "RWF": 1300.00,
    "BWP": 13.50,
    "ZMW": 25.00,
    "CFA": 605.00,
    "AUD": 1.50,
    "NZD": 1.63,
    "ILS": 3.70,
    "UAH": 39.50,
};

export async function GET() {
  // In a real implementation, you would fetch from an API like:
  // const response = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`);
  // const data = await response.json();
  // For now, we'll return a mocked response.
  
  // A good practice is to cache this response for a few hours to avoid hitting API limits.
  return NextResponse.json({
    result: 'success',
    base_code: 'USD',
    conversion_rates: mockApiRates,
  });
}
