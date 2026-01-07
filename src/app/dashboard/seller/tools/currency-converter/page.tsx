
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
import { useCurrency } from '@/context/currency-context';
import { Calculator } from 'lucide-react';

const exchangeRates = {
  USD: 1,
  KES: 128.50,
  NGN: 1480.00,
  GHS: 14.90,
};

export default function CurrencyConverterPage() {
  const [amountUSD, setAmountUSD] = useState(100);

  const convertedAmounts = {
    KES: amountUSD * exchangeRates.KES,
    NGN: amountUSD * exchangeRates.NGN,
    GHS: amountUSD * exchangeRates.GHS,
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Currency Converter
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
                Amount in USD
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>🇰🇪 Kenyan Shilling (KES)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {convertedAmounts.KES.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>🇳🇬 Nigerian Naira (NGN)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {convertedAmounts.NGN.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>🇬🇭 Ghanaian Cedi (GHS)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {convertedAmounts.GHS.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </CardContent>
              </Card>
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
