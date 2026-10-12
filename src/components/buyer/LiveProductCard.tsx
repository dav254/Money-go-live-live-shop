'use client';

import Image from 'next/image';
import { Button } from "../ui/button";
import type { Product } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { useRouter } from "next/navigation";

export function LiveProductCard({ product }: { product: Product }) {
  const imageUrl = product.imageUrl?.trim();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const handleAddToCart = () => {
    if (!user) {
      toast({ title: 'Please log in', description: 'You need to be logged in to add items to your cart.', action: <Button onClick={() => router.push('/login')}>Login</Button> });
      return;
    }
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection not available.' });
      return;
    }
    const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
    const itemData = { productId: product.id, name: product.name, price: product.price, imageUrl: imageUrl || '', quantity: increment(1), addedAt: serverTimestamp(), sellerId: product.sellerId };
    setDoc(cartItemRef, itemData, { merge: true }).then(() => toast({ title: 'Added to cart!', description: `${product.name} has been added.` })).catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: cartItemRef.path, operation: 'write', requestResourceData: itemData })));
  };

  return (
    <div className="bg-neutral-900 p-2 rounded w-36 flex-shrink-0">
      <div className="h-20 bg-neutral-700 rounded mb-2 relative overflow-hidden">
        {imageUrl ? <Image src={imageUrl} alt={product.name || 'Product image'} fill className="object-cover" /> : <span className="flex h-full items-center justify-center px-2 text-center text-[9px] text-neutral-500">No image</span>}
      </div>
      <p className="text-sm font-semibold truncate">{product.name}</p>
      <p className="text-primary font-bold">${product.price}</p>
      <Button onClick={handleAddToCart} size="sm" className="mt-1 bg-primary hover:bg-primary/90 w-full py-1 rounded text-sm h-7">Add</Button>
    </div>
  );
}
