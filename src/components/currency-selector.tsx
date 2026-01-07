
'use client';

import * as React from 'react';
import { useCurrency } from '@/context/currency-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="px-3">
          <Globe className="h-4 w-4 mr-2" />
          {currency}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40">
        <DropdownMenuLabel>Select Currency</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currency} onValueChange={setCurrency}>
          <DropdownMenuRadioItem value="USD">USD - US Dollar</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="KES">KES - Kenyan Shilling</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="NGN">NGN - Nigerian Naira</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="GHS">GHS - Ghanaian Cedi</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
