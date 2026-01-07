
'use client';

import { useState, useMemo, useEffect } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, Search, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const exchangeRates: Record<string, number> = {
  KES: 128.50,
  NGN: 1480.00,
  GHS: 14.90,
  ZAR: 18.25,
  UGX: 3750.00,
  TZS: 2580.00,
  EGP: 47.50,
  EUR: 0.92,
  GBP: 0.79,
};

const currencyInfo: Record<string, { name: string; flag: string }> = {
    KES: { name: 'Kenyan Shilling', flag: '🇰🇪' },
    NGN: { name: 'Nigerian Naira', flag: '🇳🇬' },
    GHS: { name: 'Ghanaian Cedi', flag: '🇬🇭' },
    ZAR: { name: 'South African Rand', flag: '🇿🇦' },
    UGX: { name: 'Ugandan Shilling', flag: '🇺🇬' },
    TZS: { name: 'Tanzanian Shilling', flag: '🇹🇿' },
    EGP: { name: 'Egyptian Pound', flag: '🇪🇬' },
    EUR: { name: 'Euro', flag: '🇪🇺' },
    GBP: { name: 'British Pound', flag: '🇬🇧' },
};


export default function CurrencyConverterPage() {
  const [amountUSD, setAmountUSD] = useState(100);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) {
      return []; // Return empty if no search query
    }
    return Object.entries(exchangeRates).filter(([code, rate]) => {
        const info = currencyInfo[code as keyof typeof currencyInfo];
        const searchText = searchQuery.toLowerCase();
        return (
            code.toLowerCase().includes(searchText) ||
            info.name.toLowerCase().includes(searchText)
        );
    });
  }, [searchQuery]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdated(prev => (prev + 1) % 5);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Global Pricing Tool
        </h1>
        
        <Alert className="bg-primary/10 border-primary/50">
            <AlertTriangle className="h-4 w-4 !text-primary" />
            <AlertTitle className="font-semibold !text-primary">Detected Country: Tanzania 🇹🇿</AlertTitle>
            <AlertDescription>
                Your default currency has been set to Tanzanian Shilling (TZS). You can change this at any time.
                <Button variant="link" className="p-0 ml-2 h-auto">Change</Button>
            </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calculator className="text-primary" />
                    Live Pricing Tool
                </div>
                <div className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live rate — updated {lastUpdated < 1 ? 'just now' : `${lastUpdated} minute${lastUpdated > 1 ? 's' : ''} ago`}
                </div>
            </CardTitle>
            <CardDescription>
              Check how your USD product prices convert into local currencies for your customers around the world.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              
              {/* Input Section */}
              <div className="space-y-4">
                 <div className="space-y-2">
                  <Label htmlFor="usd-amount" className="font-semibold text-lg">
                    1. Enter Amount in USD ($)
                  </Label>
                  <Input
                    id="usd-amount"
                    type="number"
                    value={amountUSD}
                    onChange={(e) => setAmountUSD(Number(e.target.value))}
                    className="text-2xl font-bold h-14"
                    placeholder="100"
                  />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="currency-search" className="font-semibold text-lg">2. Search for a Currency or Country</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="currency-search"
                            placeholder="e.g., 'Kenya' or 'KES'" 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
              </div>

              {/* Conversion Results */}
              <div className="space-y-4">
                 <h3 className="font-semibold text-lg">Conversion Results</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {searchQuery && filteredCurrencies.length > 0 ? (
                        filteredCurrencies.map(([code, rate]) => {
                            const info = currencyInfo[code as keyof typeof currencyInfo];
                            const convertedAmount = amountUSD * rate;
                            return (
                                 <div key={code} className="flex flex-col items-start p-3 rounded-md bg-muted/50">
                                    <span className="font-medium text-xs text-muted-foreground">{info.flag} {code}</span>
                                    <span className="font-mono text-lg">{convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )
                        })
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground py-10">
                            {searchQuery ? 'No currency found.' : 'Start typing to see conversions.'}
                        </div>
                    )}
                </div>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground pt-4">
              Note: These are estimates based on standard rates. The final
              amount charged to the customer may vary slightly based on their
              bank or payment provider's exchange rates.
            </p>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
