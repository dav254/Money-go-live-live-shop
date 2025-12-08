
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { Loader2, Pencil, Percent } from 'lucide-react';

const mockProductsData: Product[] = [
    {
        id: 'prod-1',
        name: 'Classic Leather Handbag',
        price: 850,
        imageUrl: 'https://picsum.photos/seed/p1/150',
        stock: 12,
        commissionRate: 10,
        sellerId: 'mock-seller',
        uploadDate: new Date(),
    },
    {
        id: 'prod-2',
        name: 'Urban Explorer Sneakers',
        price: 120,
        imageUrl: 'https://picsum.photos/seed/p2/150',
        stock: 0,
        commissionRate: 15,
        sellerId: 'mock-seller',
        uploadDate: new Date(),
    },
    {
        id: 'prod-3',
        name: 'Chronograph Watch',
        price: 350,
        imageUrl: 'https://picsum.photos/seed/p3/150',
        stock: 8,
        commissionRate: 5,
        sellerId: 'mock-seller',
        uploadDate: new Date(),
    },
];


function CommissionTableRow({ product, onUpdate }: { product: Product, onUpdate: (productId: string, newRate: number) => void }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [commissionRate, setCommissionRate] = React.useState(product.commissionRate || 0);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (commissionRate < 0 || commissionRate > 100) {
      toast({ variant: 'destructive', title: 'Invalid Rate', description: 'Commission must be between 0 and 100.' });
      return;
    }
    setIsSaving(true);
    
    // Simulate a network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onUpdate(product.id, commissionRate);
    toast({ title: 'Success', description: `Commission for ${product.name} updated.` });
    setIsEditing(false);
    setIsSaving(false);
  };

  return (
    <TableRow key={product.id}>
      <TableCell>
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 rounded-md overflow-hidden">
            <Image
              src={product.imageUrl || 'https://picsum.photos/seed/product/150/150'}
              alt={product.name || 'Product image'}
              fill
              className="object-cover"
            />
          </div>
          <div className="font-medium capitalize">{product.name}</div>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{product.price.toLocaleString()}</TableCell>
      <TableCell className="text-right">
        {isEditing ? (
          <div className="flex justify-end items-center gap-2">
            <div className="relative">
                <Input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                className="w-24 text-right pr-7"
                autoFocus
                />
                <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving || commissionRate === (product.commissionRate || 0)}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="text-right flex justify-end items-center gap-2 group min-h-[40px]">
            <span className="font-medium">{product.commissionRate || 0}%</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={() => {
                setCommissionRate(product.commissionRate || 0);
                setIsEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">{product.stock}</TableCell>
    </TableRow>
  );
}

export function CommissionSettingsTable() {
  const [productsData, setProductsData] = React.useState<Product[]>(mockProductsData);
  const [isLoading, setIsLoading] = React.useState(true);

  // Simulate initial data loading
  React.useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  const handleProductUpdate = (productId: string, newRate: number) => {
      setProductsData(prevProducts => 
          prevProducts.map(p => 
              p.id === productId ? { ...p, commissionRate: newRate } : p
          )
      );
  };


  if (isLoading) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Price (USD)</TableHead>
                        <TableHead className="text-right">Commission Rate</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-16 mx-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Price (USD)</TableHead>
              <TableHead className="text-right">Commission Rate</TableHead>
              <TableHead className="text-center">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productsData && productsData.length > 0 ? (
              productsData.map((product) => (
                <CommissionTableRow key={product.id} product={product} onUpdate={handleProductUpdate} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  You haven't uploaded any products yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
