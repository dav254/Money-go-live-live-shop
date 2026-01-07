
'use client';

import React, { createContext, useState, useContext, useMemo, ReactNode } from 'react';

// Define the shape of the currency context
interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  getConvertedPrice: (priceInUsd: number) => string;
  rate: number;
}

// Mock exchange rates relative to USD - EXPANDED LIST
const exchangeRates: { [key: string]: number } = {
  USD: 1,      // United States Dollar
  KES: 128.50, // Kenyan Shilling
  NGN: 1480.00, // Nigerian Naira
  GHS: 14.90,  // Ghanaian Cedi
  ZAR: 18.25,  // South African Rand
  UGX: 3750.00, // Ugandan Shilling
  TZS: 2580.00, // Tanzanian Shilling
  EGP: 47.50,  // Egyptian Pound
  EUR: 0.92,   // Euro
  GBP: 0.79,   // British Pound
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
