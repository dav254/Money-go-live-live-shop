
'use client';

import { useState, useMemo } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Calculator, Search } from 'lucide-react';

const exchangeRates = {
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
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCurrencies = useMemo(() => {
    // Only return results if there is a search term
    if (!searchTerm) {
      return [];
    }
    return Object.entries(exchangeRates).filter(([code, rate]) => {
      const info = currencyInfo[code as keyof typeof currencyInfo];
      const searchTermLower = searchTerm.toLowerCase();
      return (
        code.toLowerCase().includes(searchTermLower) ||
        info.name.toLowerCase().includes(searchTermLower)
      );
    });
  }, [searchTerm]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Global Currency Converter
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="text-primary" />
              Live Pricing Tool
            </CardTitle>
            <CardDescription>
              Enter a price in USD to see its approximate value in other
              currencies. This helps you understand what international buyers
              see.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="usd-amount" className="text-lg font-semibold">
                    Enter Amount in USD ($)
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
                  <Label htmlFor="search-currency" className="text-lg font-semibold">
                    Search Currency or Country
                  </Label>
                   <div className="relative">
                     <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                     <Input
                        id="search-currency"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-lg h-14 pl-10"
                        placeholder="e.g., Kenya or KES"
                      />
                   </div>
                </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchTerm && filteredCurrencies.length > 0 ? (
                    filteredCurrencies.map(([code, rate]) => {
                        const info = currencyInfo[code as keyof typeof currencyInfo];
                        const convertedAmount = amountUSD * rate;
                        return (
                            <Card key={code}>
                                <CardHeader>
                                <CardTitle className="text-base">{info.flag} {info.name} ({code})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                <p className="text-2xl font-bold">
                                    {convertedAmount.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                    })}
                                </p>
                                </CardContent>
                            </Card>
                        )
                    })
                ) : searchTerm ? (
                     <p className="text-muted-foreground col-span-full text-center py-8">
                        No currencies found for "{searchTerm}".
                    </p>
                ) : (
                     <p className="text-muted-foreground col-span-full text-center py-8">
                        Start typing to search for a currency.
                    </p>
                )}
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
