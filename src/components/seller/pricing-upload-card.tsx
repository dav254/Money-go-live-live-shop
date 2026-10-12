import { useState } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PricingUploadCard() {
  const [currency, setCurrency] = useState<string>('KES');
  const [salePrice, setSalePrice] = useState<string>('100');
  const [wasPrice, setWasPrice] = useState<string>('1000');
  const [stock, setStock] = useState<string>('100');
  const [delivery, setDelivery] = useState<string>('Sbnsjsjsms');

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border bg-[#111625] p-5">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-white">PRICE IT, SHIP IT</p>
        <p className="text-xs leading-relaxed text-muted-foreground uppercase">
          THE USD VALUE LOCKS YOUR PRICE FOR GLOBAL SETTLEMENT.
        </p>
      </div>

      {/* Status banner */}
      <div className="flex items-center justify-between rounded-2xl bg-[#e53935] px-4 py-3">
        <p className="text-sm font-semibold text-white">
          Almost there
          <br />
          <span className="text-sm font-bold">USD value must be greater than 0.</span>
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">CURRENCY</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-11 bg-white/5 pr-10">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {['KES', 'USD', 'NGN', 'GHS', 'ZAR', 'UGX', 'TZS', 'EUR', 'GBP'].map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">SALE PRICE</Label>
            <Input
              className="h-11 bg-white/5 text-white placeholder:text-muted-foreground"
              placeholder="0.00"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">WAS PRICE</Label>
          <Input
            className="h-11 bg-white/5 text-white placeholder:text-muted-foreground"
            placeholder="0.00"
            value={wasPrice}
            onChange={(e) => setWasPrice(e.target.value)}
          />
        </div>

        {/* Row 3 */}
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">STOCK</Label>
          <Input
            className="h-11 bg-white/5 text-white placeholder:text-muted-foreground"
            placeholder="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>

        {/* Row 4 */}
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">DELIVERY</Label>
          <Input
            className="h-24 bg-white/5 text-white placeholder:text-muted-foreground"
            placeholder="Type delivery instructions"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
          />
        </div>
      </div>

      <Button
        className="h-12 rounded-xl bg-[#d85a3a] text-sm font-bold uppercase tracking-[0.12em] text-white"
        size="sm"
      >
        Publish listing
      </Button>
    </section>
  );
}
