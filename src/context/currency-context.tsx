
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
    USD: 1,
    EUR: 0.92,
    JPY: 157.00,
    GBP: 0.79,
    AUD: 1.50,
    CAD: 1.37,
    CHF: 0.90,
    CNY: 7.25,
    INR: 83.50,
    BRL: 5.25,
    RUB: 90.00,
    ZAR: 18.25,
    NGN: 1480.00,
    KES: 128.50,
    GHS: 14.90,
    UGX: 3750.00,
    TZS: 2580.00,
    EGP: 47.50,
    AED: 3.67,
    SAR: 3.75,
    QAR: 3.64,
    ETB: 57.00,
    RWF: 1300.00,
    BWP: 13.50,
    ZMW: 25.00,
    MXN: 17.00,
    SGD: 1.35,
    HKD: 7.80
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
