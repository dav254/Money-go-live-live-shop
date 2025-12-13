'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';

export default function ProductForm() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: products, isLoading } = useCollection<Product>(productsQuery);

  function handleNext() {
    if (selectedProductId) {
        localStorage.setItem('selectedProductId', selectedProductId);
        router.push('/seller/studio/preview');
    } else {
        alert('Please select a product to continue.');
    }
  }

  function handleSaveDraft() {
    alert('Product saved as a draft! (Feature coming soon)');
  }

  return (
    <div className="space-y-4">
        <Card>
            <CardHeader>
                <CardTitle>Select a Product</CardTitle>
                <CardDescription>Choose which product this video is for. The video will be added to this product's media gallery.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-96">
                    <RadioGroup value={selectedProductId || ''} onValueChange={setSelectedProductId}>
                        <div className="space-y-2">
                        {isLoading && <p>Loading products...</p>}
                        {products?.map((product) => (
                           <Label 
                                key={product.id}
                                htmlFor={product.id}
                                className={cn("flex items-center gap-4 rounded-lg p-3 border-2 border-transparent transition-colors", 
                                    selectedProductId === product.id ? "border-primary bg-primary/10" : "border-card bg-card hover:bg-muted/50"
                                )}
                            >
                                <RadioGroupItem value={product.id} id={product.id} />
                                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                                    <Image src={product.imageUrl || '/placeholder.svg'} alt={product.name || 'Product Image'} fill className="object-cover" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold">{product.name}</p>
                                    <p className="text-sm text-primary">{product.price.toLocaleString()}</p>
                                </div>
                           </Label>
                        ))}
                        </div>
                    </RadioGroup>
                </ScrollArea>
            </CardContent>
        </Card>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={handleSaveDraft} className="bg-gray-700 px-4 py-2 rounded-lg text-white">Save Draft</button>
        <button type="button" onClick={handleNext} disabled={!selectedProductId} className="bg-red-600 px-4 py-2 rounded-lg text-white disabled:bg-gray-500">Next</button>
      </div>
    </div>
  );
}
