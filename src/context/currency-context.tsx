
'use client';

import React, { createContext, useState, useContext, useMemo, ReactNode } from 'react';

// Define the shape of the currency context
interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  getConvertedPrice: (priceInUsd: number) => string;
  rate: number;
}

const exchangeRates: Record<string, number> = {
    // North America
    USD: 1,
    CAD: 1.37,
    MXN: 17.00,
    // Europe
    EUR: 0.92,
    GBP: 0.79,
    CHF: 0.90,
    SEK: 10.50,
    NOK: 10.60,
    DKK: 6.85,
    PLN: 3.95,
    CZK: 23.00,
    HUF: 360.00,
    RUB: 90.00,
    TRY: 32.50,
    // Asia
    CNY: 7.25,
    JPY: 157.00,
    INR: 83.50,
    KRW: 1375.00,
    SGD: 1.35,
    HKD: 7.80,
    AED: 3.67,
    SAR: 3.75,
    QAR: 3.64,
    IDR: 16200.00,
    MYR: 4.70,
    PHP: 58.70,
    THB: 36.70,
    VND: 25400.00,
    // South America
    BRL: 5.25,
    ARS: 900.00,
    CLP: 925.00,
    COP: 3900.00,
    PEN: 3.75,
    // Africa
    NGN: 1480.00,
    KES: 128.50,
    GHS: 14.90,
    ZAR: 18.25,
    EGP: 47.50,
    UGX: 3750.00,
    TZS: 2580.00,
    ETB: 57.00,
    RWF: 1300.00,
    BWP: 13.50,
    ZMW: 25.00,
    CFA: 605.00, // West African CFA Franc
    // Oceania
    AUD: 1.50,
    NZD: 1.63,
    // Other
    ILS: 3.70,
    UAH: 39.50,
};

// Create the context
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Create the provider component
export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<string>('USD');

  const rate = exchangeRates[currency] || 1;

  const getConvertedPrice = (priceInUsd: number): string => {
    const convertedAmount = priceInUsd * rate;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(convertedAmount);
  };

  const value = useMemo(() => ({
    currency,
    setCurrency,
    rate,
    getConvertedPrice,
  }), [currency, rate, getConvertedPrice]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Create a custom hook to use the currency context
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
