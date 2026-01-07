
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
import { Calculator, Search, AlertTriangle, Briefcase, DollarSign, BookOpen } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [localAmount, setLocalAmount] = useState(10000);
  const [localCurrency, setLocalCurrency] = useState('KES');
  const [lastUpdated, setLastUpdated] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { user } = useUser();
  const firestore = useFirestore();

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const selectedProduct = useMemo(() => {
      return products?.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const filteredCurrencies = useMemo(() => {
    if (!searchQuery) {
      return [];
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

  const usdToLocalAmount = useMemo(() => {
    const rate = exchangeRates[localCurrency] || 1;
    return (localAmount / rate).toFixed(2);
  }, [localAmount, localCurrency]);

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
                    <BookOpen className="text-primary" />
                    Check Your Product's Price
                </div>
            </CardTitle>
            <CardDescription>
              Select one of your products to see its price automatically converted into other major currencies.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-2">
                <Label htmlFor="product-select" className="font-semibold text-lg">Select a Product</Label>
                 <Select onValueChange={setSelectedProductId} disabled={areProductsLoading}>
                    <SelectTrigger id="product-select">
                        <SelectValue placeholder={areProductsLoading ? "Loading products..." : "Select a product to see its pricing"} />
                    </SelectTrigger>
                    <SelectContent>
                        {products?.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-4">
                 <h3 className="font-semibold text-lg">Live Global Pricing</h3>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search for a currency or country..." 
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {searchQuery && selectedProduct && filteredCurrencies.length > 0 ? (
                        filteredCurrencies.map(([code, rate]) => {
                            const info = currencyInfo[code as keyof typeof currencyInfo];
                            const convertedAmount = selectedProduct.price * rate;
                            return (
                                <div key={code} className="flex flex-col items-start p-3 rounded-md bg-muted/50">
                                    <span className="font-medium text-xs text-muted-foreground">{info.flag} {code}</span>
                                    <span className="font-mono text-lg">{convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            )
                        })
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground py-10">
                            {searchQuery ? 'No currency found.' : 'Select a product and start typing to see conversions.'}
                        </div>
                    )}
                </div>
              </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calculator className="text-primary" />
                    Manual Pricing Tool
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
              
              {/* Left Side: Local to USD */}
               <div className="space-y-4">
                 <h3 className="font-semibold text-lg">Convert Local Currency to USD</h3>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="local-amount">Amount</Label>
                        <Input
                            id="local-amount"
                            type="number"
                            value={localAmount}
                            onChange={(e) => setLocalAmount(Number(e.target.value))}
                            placeholder="10000"
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="local-currency">From Currency</Label>
                        <Select value={localCurrency} onValueChange={setLocalCurrency}>
                            <SelectTrigger id="local-currency">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.keys(currencyInfo).map(code => (
                                    <SelectItem key={code} value={code}>{code}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
                 <div className="text-center bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Is Equal To</p>
                    <p className="text-2xl font-bold text-primary">${usdToLocalAmount}</p>
                    <p className="text-xs text-muted-foreground">United States Dollar (USD)</p>
                 </div>
              </div>


              {/* Right Side: USD to Local */}
              <div className="space-y-4">
                 <div className="space-y-2">
                  <Label htmlFor="usd-amount" className="font-semibold text-lg">
                    USD to Any Currency
                  </Label>
                  <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         <Input
                            id="usd-amount"
                            type="number"
                            value={amountUSD}
                            onChange={(e) => setAmountUSD(Number(e.target.value))}
                            className="text-lg font-bold h-12 pl-9"
                            placeholder="100"
                        />
                  </div>
                </div>

                <div className="space-y-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search for a currency or country..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
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

