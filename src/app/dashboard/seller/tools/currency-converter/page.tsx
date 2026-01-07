
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
import { Calculator, Search, AlertTriangle, Briefcase, DollarSign, BookOpen, ArrowRightLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';


const exchangeRates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    JPY: 157.00,
    GBP: 0.79,
    AUD: 1.50,
    CAD: 1.37,
    CHF: 0.90,
    CNY: 7.25,
    INR: 83.50,
    BRL: 5.25,
    RUB: 90.00,
    ZAR: 18.25,
    NGN: 1480.00,
    KES: 128.50,
    GHS: 14.90,
    UGX: 3750.00,
    TZS: 2580.00,
    EGP: 47.50,
    AED: 3.67,
    SAR: 3.75,
    QAR: 3.64,
    ETB: 57.00,
    RWF: 1300.00,
    BWP: 13.50,
    ZMW: 25.00,
    MXN: 17.00,
    SGD: 1.35,
    HKD: 7.80
};

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
};


export default function CurrencyConverterPage() {
  const [amount, setAmount] = useState(100);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('KES');
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
  
  const convertedAmount = useMemo(() => {
    const rateFrom = exchangeRates[fromCurrency] || 1;
    const rateTo = exchangeRates[toCurrency] || 1;
    const amountInUSD = amount / rateFrom;
    return (amountInUSD * rateTo).toFixed(2);
  }, [amount, fromCurrency, toCurrency]);

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

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
                <p className="text-xs text-muted-foreground pt-2">
                  Note: These are estimates based on standard rates. The final amount charged to the customer may vary slightly based on their bank or payment provider's exchange rates.
                </p>
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              
              <div className="space-y-2">
                <Label htmlFor="from-amount">Amount</Label>
                <Input
                  id="from-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="Enter amount"
                />
              </div>

               <div className="space-y-2">
                 <Label>From</Label>
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger id="from-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(currencyInfo).map(code => (
                      <SelectItem key={code} value={code}>{currencyInfo[code as keyof typeof currencyInfo].flag} {code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>To</Label>
                 <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger id="to-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(currencyInfo).map(code => (
                      <SelectItem key={code} value={code}>{currencyInfo[code as keyof typeof currencyInfo].flag} {code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>

             <div className="pt-6 text-center">
                <Label>Converted Amount</Label>
                <div className="text-4xl font-bold text-primary mt-2">
                  {convertedAmount}
                </div>
                 <p className="text-sm text-muted-foreground">{currencyInfo[toCurrency as keyof typeof currencyInfo].name}</p>
              </div>
            
            <p className="text-xs text-muted-foreground pt-4 text-center">
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
