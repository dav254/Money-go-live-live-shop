
'use client';

import React, { createContext, useState, useContext, useMemo, ReactNode, useEffect } from 'react';

// Define the shape of the currency context
interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  getConvertedPrice: (priceInUsd: number) => string;
  rate: number;
  exchangeRates: Record<string, number> | null;
  ratesLastFetched: Date | null;
  isLoadingRates: boolean;
  ratesError: boolean;
}

// Create the context
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Create the provider component
export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<string>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [ratesLastFetched, setRatesLastFetched] = useState<Date | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [ratesError, setRatesError] = useState(false);


  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('/api/exchange-rates');
        if (!response.ok) {
          throw new Error(`Failed to fetch from API route. Status: ${response.status}`);
        }
        const data = await response.json();

        if (data?.rates && typeof data.rates === 'object') {
          setExchangeRates(data.rates);
          setRatesLastFetched(new Date(data.updated || Date.now()));
          setRatesError(false);
        } else {
          // This case should ideally not be hit now that the API route has a fallback
          console.error('Malformed API payload:', data);
          throw new Error('API response did not contain valid rates.');
        }
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
        setRatesError(true);
      } finally {
        setIsLoadingRates(false);
      }
    };

    fetchRates();
    // Refresh every 10 minutes
    const interval = setInterval(fetchRates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const rate = useMemo(() => {
    return exchangeRates && exchangeRates[currency] ? exchangeRates[currency] : 1;
  }, [exchangeRates, currency]);

  const getConvertedPrice = (priceInUsd: number): string => {
    if (!exchangeRates || isLoadingRates || ratesError) return '...';
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
    exchangeRates,
    getConvertedPrice,
    ratesLastFetched,
    isLoadingRates,
    ratesError,
  }), [currency, rate, exchangeRates, getConvertedPrice, ratesLastFetched, isLoadingRates, ratesError]);

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
