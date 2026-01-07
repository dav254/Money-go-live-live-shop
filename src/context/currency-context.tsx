
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
}

const currencyInfo: Record<string, { name: string; flag: string }> = {
    USD: { name: 'US Dollar', flag: '🇺🇸' },
    EUR: { name: 'Euro', flag: '🇪🇺' },
    JPY: { name: 'Japanese Yen', flag: '🇯🇵' },
    GBP: { name: 'British Pound', flag: '🇬🇧' },
    AUD: { name: 'Australian Dollar', flag: '🇦🇺' },
    CAD: { name: 'Canadian Dollar', flag: '🇨🇦' },
    CHF: { name: 'Swiss Franc', flag: '🇨🇭' },
    CNY: { name: 'Chinese Yuan', flag: '🇨🇳' },
    INR: { name: 'Indian Rupee', flag: '🇮🇳' },
    BRL: { name: 'Brazilian Real', flag: '🇧🇷' },
    RUB: { name: 'Russian Ruble', flag: '🇷🇺' },
    ZAR: { name: 'South African Rand', flag: '🇿🇦' },
    NGN: { name: 'Nigerian Naira', flag: '🇳🇬' },
    KES: { name: 'Kenyan Shilling', flag: '🇰🇪' },
    GHS: { name: 'Ghanaian Cedi', flag: '🇬🇭' },
    UGX: { name: 'Ugandan Shilling', flag: '🇺🇬' },
    TZS: { name: 'Tanzanian Shilling', flag: '🇹🇿' },
    EGP: { name: 'Egyptian Pound', flag: '🇪🇬' },
    AED: { name: 'UAE Dirham', flag: '🇦🇪' },
    SAR: { name: 'Saudi Riyal', flag: '🇸🇦' },
    QAR: { name: 'Qatari Riyal', flag: '🇶🇦' },
    ETB: { name: 'Ethiopian Birr', flag: '🇪🇹' },
    RWF: { name: 'Rwandan Franc', flag: '🇷🇼' },
    BWP: { name: 'Botswana Pula', flag: '🇧🇼' },
    ZMW: { name: 'Zambian Kwacha', flag: '🇿🇲' },
    MXN: { name: 'Mexican Peso', flag: '🇲🇽' },
    SGD: { name: 'Singapore Dollar', flag: '🇸🇬' },
    HKD: { name: 'Hong Kong Dollar', flag: '🇭🇰' },
    SEK: { name: 'Swedish Krona', flag: '🇸🇪' },
    NOK: { name: 'Norwegian Krone', flag: '🇳🇴' },
    DKK: { name: 'Danish Krone', flag: '🇩🇰' },
    PLN: { name: 'Polish Złoty', flag: '🇵🇱' },
    CZK: { name: 'Czech Koruna', flag: '🇨🇿' },
    HUF: { name: 'Hungarian Forint', flag: '🇭🇺' },
    TRY: { name: 'Turkish Lira', flag: '🇹🇷' },
    KRW: { name: 'South Korean Won', flag: '🇰🇷' },
    IDR: { name: 'Indonesian Rupiah', flag: '🇮🇩' },
    MYR: { name: 'Malaysian Ringgit', flag: '🇲🇾' },
    PHP: { name: 'Philippine Peso', flag: '🇵🇭' },
    THB: { name: 'Thai Baht', flag: '🇹🇭' },
    VND: { name: 'Vietnamese Đồng', flag: '🇻🇳' },
    ARS: { name: 'Argentine Peso', flag: '🇦🇷' },
    CLP: { name: 'Chilean Peso', flag: '🇨🇱' },
    COP: { name: 'Colombian Peso', flag: '🇨🇴' },
    PEN: { name: 'Peruvian Sol', flag: '🇵🇪' },
    NZD: { name: 'New Zealand Dollar', flag: '🇳🇿' },
    ILS: { name: 'Israeli New Shekel', flag: '🇮🇱' },
    UAH: { name: 'Ukrainian Hryvnia', flag: '🇺🇦' },
    CFA: { name: 'CFA Franc', flag: '🇨🇫' }
};

// Create the context
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Create the provider component
export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<string>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [ratesLastFetched, setRatesLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('/api/rates');
        const data = await response.json();
        if (data.result === 'success') {
          setExchangeRates(data.conversion_rates);
          setRatesLastFetched(new Date());
        } else {
          console.error("Failed to fetch exchange rates:", data);
        }
      } catch (error) {
        console.error("Error fetching exchange rates API:", error);
      }
    };

    fetchRates();
  }, []);

  const rate = exchangeRates ? exchangeRates[currency] || 1 : 1;

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
    exchangeRates,
    getConvertedPrice,
    ratesLastFetched,
  }), [currency, rate, exchangeRates, ratesLastFetched]);

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
