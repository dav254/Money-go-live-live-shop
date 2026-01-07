
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
import { Calculator, Search, ArrowRightLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [searchTerm, setSearchTerm] = useState('');
  
  const [localAmount, setLocalAmount] = useState(10000);
  const [localCurrency, setLocalCurrency] = useState('KES');
  
  const usdEquivalent = useMemo(() => {
    if (!localCurrency || !exchangeRates[localCurrency]) return 0;
    return localAmount / exchangeRates[localCurrency];
  }, [localAmount, localCurrency]);

  const filteredCurrencies = useMemo(() => {
    if (!searchTerm) {
      return [];
    }
    const searchTermLower = searchTerm.toLowerCase();
    return Object.entries(exchangeRates).filter(([code]) => {
      const info = currencyInfo[code as keyof typeof currencyInfo];
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
              Use these tools to understand your pricing in a global context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Two-column layout for converters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* USD to Other Currencies */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg">USD to Other Currencies</h3>
                     <div className="space-y-2">
                      <Label htmlFor="usd-amount">
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
                      <Label htmlFor="search-currency">
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
                    {/* Results for USD to Other */}
                     <div className="grid grid-cols-1 gap-2 pt-2">
                        {searchTerm && filteredCurrencies.length > 0 ? (
                            filteredCurrencies.map(([code, rate]) => {
                                const info = currencyInfo[code as keyof typeof currencyInfo];
                                const convertedAmount = amountUSD * rate;
                                return (
                                     <div key={code} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                        <span className="font-medium">{info.flag} {code}</span>
                                        <span className="font-mono text-lg">{convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )
                            })
                        ) : searchTerm ? (
                             <p className="text-muted-foreground text-center py-4">No currency found for "{searchTerm}".</p>
                        ) : (
                             <p className="text-muted-foreground text-center py-4">Search to see conversions.</p>
                        )}
                    </div>
                </div>

                {/* Local to USD */}
                 <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Local Currency to USD</h3>
                    <div className="flex gap-4">
                        <div className="space-y-2 flex-1">
                          <Label htmlFor="local-amount">
                            Local Amount
                          </Label>
                          <Input
                            id="local-amount"
                            type="number"
                            value={localAmount}
                            onChange={(e) => setLocalAmount(Number(e.target.value))}
                            className="text-xl font-bold h-14"
                            placeholder="10000"
                          />
                        </div>
                        <div className="space-y-2 w-32">
                           <Label htmlFor="local-currency">
                            Currency
                          </Label>
                          <Select value={localCurrency} onValueChange={setLocalCurrency}>
                            <SelectTrigger id="local-currency" className="h-14 text-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(exchangeRates).map(code => (
                                    <SelectItem key={code} value={code}>{code}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                    </div>
                    <div className="flex items-center justify-center text-muted-foreground py-2">
                       <ArrowRightLeft />
                    </div>
                    <div className="space-y-2">
                        <Label>Equivalent in USD ($)</Label>
                        <div className="flex items-center p-4 h-14 rounded-md border text-2xl font-bold bg-muted/50">
                          ${usdEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground">This is the price you should set in your product listing.</p>
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
