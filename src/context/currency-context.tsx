
'use client';

import React, { createContext, useState, useContext, useMemo, ReactNode } from 'react';

// Define the shape of the currency context
interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  getConvertedPrice: (priceInUsd: number) => string;
  rate: number;
}

// Mock exchange rates relative to USD
const exchangeRates: { [key: string]: number } = {
  USD: 1,
  KES: 128.50, // Kenyan Shilling
  NGN: 1480.00, // Nigerian Naira
  GHS: 14.90,  // Ghanaian Cedi
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
  }), [currency, rate]);

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
