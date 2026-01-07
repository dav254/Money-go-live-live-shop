
'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { Calculator, AlertTriangle, BookOpen, Search, Check, ChevronsUpDown, DollarSign } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
};

const currencies = Object.keys(currencyInfo).map(code => ({
    value: code,
    label: `${currencyInfo[code].flag} ${code} - ${currencyInfo[code].name}`
}));

const CurrencyCombobox = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value
                        ? currencies.find((currency) => currency.value === value)?.label
                        : "Select currency..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search currency..." />
                    <CommandList>
                        <CommandEmpty>No currency found.</CommandEmpty>
                        <CommandGroup>
                            {currencies.map((currency) => (
                                <CommandItem
                                    key={currency.value}
                                    value={currency.value}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue.toUpperCase());
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === currency.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {currency.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default function CurrencyConverterPage() {
  const [amount, setAmount] = useState(100);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('KES');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  const { exchangeRates, getConvertedPrice, ratesLastFetched, isLoadingRates, ratesError } = useCurrency();
  const [lastUpdatedText, setLastUpdatedText] = useState('just now');

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
  
    useEffect(() => {
        if(selectedProduct) {
            setAmount(selectedProduct.price);
            setFromCurrency('USD');
        }
    }, [selectedProduct]);

  useEffect(() => {
    const updateText = () => {
        if (ratesLastFetched) {
            const text = formatDistanceToNow(ratesLastFetched, { addSuffix: true });
            setLastUpdatedText(text);
        }
    }
    updateText();
    const timer = setInterval(updateText, 60000); // Update every minute
    return () => clearInterval(timer);
  }, [ratesLastFetched]);
  
  const convertedAmount = useMemo(() => {
    if (!exchangeRates || isLoadingRates || ratesError) return '...'; 
    const rateFrom = exchangeRates[fromCurrency] || 1;
    const rateTo = exchangeRates[toCurrency] || 1;
    const amountInUSD = amount / rateFrom;
    const finalAmount = amountInUSD * rateTo;

    return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(finalAmount);
  }, [amount, fromCurrency, toCurrency, exchangeRates, isLoadingRates, ratesError]);

  return (
    <SellerLayout>
      <div className="flex-1 space-y-6 p-8 pt-6">
        <h1 className="font-headline text-3xl font-bold tracking-tight">
          Global Pricing Tool
        </h1>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <DollarSign /> Check Your Product's Price
                </div>
            </CardTitle>
            <CardDescription>
              Select one of your products to see its price automatically converted into other major currencies.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <div className="space-y-2">
                <Label htmlFor="product-select">Select a Product</Label>
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
                    {isLoadingRates ? (
                      <span className="text-xs text-muted-foreground">Fetching live rates…</span>
                    ) : ratesError ? (
                      <span className="text-xs text-red-500">Rate service unavailable</span>
                    ) : (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        ● Live rate — updated {lastUpdatedText}
                      </span>
                    )}
                </div>
            </CardTitle>
            <CardDescription>
              Check how your USD product prices convert into local currencies for your customers around the world.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              
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

               <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>From</Label>
                        <CurrencyCombobox value={fromCurrency} onChange={setFromCurrency} />
                    </div>
                     <div className="space-y-2">
                        <Label>To</Label>
                        <CurrencyCombobox value={toCurrency} onChange={setToCurrency} />
                    </div>
               </div>

            </div>

             <div className="pt-6 text-center">
                <Label>Converted Amount</Label>
                <div className="text-4xl font-bold text-primary mt-2">
                  {convertedAmount}
                </div>
                 <p className="text-sm text-muted-foreground">{currencyInfo[toCurrency]?.name || ''}</p>
              </div>
            
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}

    