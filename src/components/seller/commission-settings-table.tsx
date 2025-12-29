
'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';

// --- Static Placeholder Data ---
const staticProducts = [
  { id: 'prod1', name: 'Vintage Leather Jacket', imageUrl: 'https://picsum.photos/seed/jacket/40', price: 120.00, commissionRate: 10, resellingEnabled: true },
  { id: 'prod2', name: 'Handmade Ceramic Mug', imageUrl: 'https://picsum.photos/seed/mug/40', price: 25.50, commissionRate: 0, resellingEnabled: false },
  { id: 'prod3', name: 'Retro Sunglasses', imageUrl: 'https://picsum.photos/seed/glasses/40', price: 45.00, commissionRate: 15, resellingEnabled: true },
  { id: 'prod4', name: 'Designer Handbag', imageUrl: 'https://picsum.photos/seed/bag/40', price: 350.00, commissionRate: 10, resellingEnabled: true },
];

/**
 * A component for a single row in the commission settings table.
 * It manages its own state for demonstration purposes.
 */
function CommissionRow({ product: initialProduct }: { product: typeof staticProducts[0] }) {
  const { toast } = useToast();
  const [product, setProduct] = React.useState(initialProduct);

  const resellerEarns = (product.price * product.commissionRate) / 100;
  const youGet = product.price - resellerEarns;

  const handleCommissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newRate = parseFloat(e.target.value);
    if (isNaN(newRate) || newRate < 0) newRate = 0;
    if (newRate > 100) newRate = 100;
    setProduct(p => ({ ...p, commissionRate: newRate }));
  };

  const handleToggleEnabled = (enabled: boolean) => {
    setProduct(p => ({ ...p, resellingEnabled: enabled, commissionRate: enabled ? 10 : 0 }));
  };
  
  const handleSave = () => {
      toast({
          title: "Action Not Saved",
          description: "This is a frontend-only demonstration. Changes are not being saved to the backend."
      })
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" />
          <span>{product.name}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-medium">${product.price.toFixed(2)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
            <Input
                type="number"
                value={product.commissionRate}
                onChange={handleCommissionChange}
                className="w-20"
                min="0"
                max="100"
            />
            <span>%</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold text-green-500">${resellerEarns.toFixed(2)}</TableCell>
      <TableCell className="text-right font-bold">${youGet.toFixed(2)}</TableCell>
      <TableCell className="text-right">
        <Switch
          checked={product.resellingEnabled}
          onCheckedChange={handleToggleEnabled}
        />
      </TableCell>
      <TableCell className="text-right">
          <Button size="sm" variant="outline" onClick={handleSave}>Save</Button>
      </TableCell>
    </TableRow>
  );
}

/**
 * Main component to display the commission settings table with static data.
 */
export function CommissionSettingsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead>Commission Rate</TableHead>
          <TableHead className="text-right">Reseller Earns</TableHead>
          <TableHead className="text-right">You Get</TableHead>
          <TableHead className="text-right">Enable Reselling</TableHead>
           <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staticProducts.map((product) => (
          <CommissionRow key={product.id} product={product} />
        ))}
      </TableBody>
    </Table>
  );
}
