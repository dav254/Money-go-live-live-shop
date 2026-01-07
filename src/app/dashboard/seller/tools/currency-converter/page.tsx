
'use client';

import { useState } from 'react';
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
import { Calculator } from 'lucide-react';

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

const currencyInfo = {
    KES: { name: 'Kenyan Shilling', flag: '🇰🇪' },
    NGN: { name: 'Nigerian Naira', flag: '🇳🇬' },
    GHS: { name: 'Ghanaian Cedi', flag: '🇬🇭' },
    ZAR: { name: 'South African Rand', flag: '🇿🇦' },
    UGX: { name: 'Ugandan Shilling', flag: '🇺🇬' },
    TZS: { name: 'Tanzanian Shilling', flag: '🇹🇿' },
    EGP: { name: 'Egyptian Pound', flag: '🇪🇬' },
    EUR: { name: 'Euro', flag: '🇪🇺' },
    GBP: { name: 'British Pound', flag: '🇬🇧' },
}


export default function CurrencyConverterPage() {
  const [amountUSD, setAmountUSD] = useState(100);

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

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(exchangeRates).map(([code, rate]) => {
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
                })}
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
