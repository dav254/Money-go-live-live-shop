
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
import { Separator } from '@/components/ui/separator';
import { Calculator, Search, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

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

  const { user } = useUser();
  const firestore = useFirestore();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [user, firestore]);

  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !products) return null;
    return products.find(p => p.id === selectedProductId);
  }, [selectedProductId, products]);

  const displayAmountUSD = useMemo(() => {
    return selectedProduct ? selectedProduct.price : amountUSD;
  }, [selectedProduct, amountUSD]);
  
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
              
              {/* Product Selector */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Check Your Product's Price</h3>
                <div className="space-y-2">
                  <Label>Select a product to see its global pricing</Label>
                  {areProductsLoading ? <Skeleton className="h-10 w-full" /> : (
                    <Select onValueChange={setSelectedProductId} value={selectedProductId || ""}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select one of your products..." />
                        </SelectTrigger>
                        <SelectContent>
                            {products?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usd-amount">
                    Or Enter a Custom Amount in USD ($)
                  </Label>
                  <Input
                    id="usd-amount"
                    type="number"
                    value={selectedProduct ? selectedProduct.price : amountUSD}
                    onChange={(e) => {
                      setAmountUSD(Number(e.target.value));
                      setSelectedProductId(null); // Clear product selection when typing custom amount
                    }}
                    className="text-2xl font-bold h-14"
                    placeholder="100"
                  />
                </div>
              </div>

              {/* Conversion Results */}
              <div className="space-y-4">
                 <h3 className="font-semibold text-lg">Global Conversions</h3>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    {Object.entries(exchangeRates).map(([code, rate]) => {
                        const info = currencyInfo[code as keyof typeof currencyInfo];
                        const convertedAmount = displayAmountUSD * rate;
                        return (
                             <div key={code} className="flex flex-col items-start p-3 rounded-md bg-muted/50">
                                <span className="font-medium text-xs text-muted-foreground">{info.flag} {code}</span>
                                <span className="font-mono text-lg">{convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        )
                    })}
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
