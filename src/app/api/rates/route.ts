
import { NextResponse } from 'next/server';

// In a real-world scenario, this would be an external API call.
// We are mocking it here for demonstration purposes.
// The API key would be stored in .env.local as process.env.EXCHANGE_RATE_API_KEY
const mockApiRates = {
    "USD": 1,
    "EUR": 0.93,
    "JPY": 157.25,
    "GBP": 0.79,
    "AUD": 1.51,
    "CAD": 1.37,
    "CHF": 0.90,
    "CNY": 7.25,
    "INR": 83.54,
    "BRL": 5.25,
    "RUB": 89.00,
    "ZAR": 18.75,
    "NGN": 1480.50,
    "KES": 130.50,
    "GHS": 14.90,
    "UGX": 3750.00,
    "TZS": 2580.00,
    "EGP": 47.65,
    "AED": 3.67,
    "SAR": 3.75,
    "QAR": 3.64,
    "ETB": 57.30,
    "RWF": 1300.00,
    "BWP": 13.50,
    "ZMW": 25.75,
    "MXN": 17.10,
    "SGD": 1.35,
    "HKD": 7.81,
    "SEK": 10.50,
    "NOK": 10.60,
    "DKK": 6.88,
    "PLN": 3.96,
    "CZK": 22.85,
    "HUF": 365.00,
    "TRY": 32.25,
    "KRW": 1380.00,
    "IDR": 16250.00,
    "MYR": 4.70,
    "PHP": 58.75,
    "THB": 36.70,
    "VND": 25450.00,
    "ARS": 900.00,
    "CLP": 925.00,
    "COP": 3950.00,
    "PEN": 3.75,
    "NZD": 1.62,
    "ILS": 3.70,
    "UAH": 40.50,
    "CFA": 605.00 
};

export async function GET() {
  // In a real implementation, you would fetch from an API like:
  // const response = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`);
  // const data = await response.json();
  // For now, we'll return a mocked response with up-to-date rates.
  
  // A good practice is to cache this response for a few hours to avoid hitting API limits.
  return NextResponse.json({
    result: 'success',
    base_code: 'USD',
    conversion_rates: mockApiRates,
  });
}

