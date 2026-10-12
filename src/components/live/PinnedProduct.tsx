'use client';

import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Button } from '../ui/button';
import { ShoppingBag, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { setDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

export function PinnedProduct({ product }: { product: Product }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  if (!product) return null;
  const imageUrl = product.imageUrl?.trim();
  const handleAddToCart = () => {
    if (!user) { router.push('/login'); return; }
    const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
    setDoc(cartItemRef, { productId: product.id, quantity: increment(1), price: product.price, name: product.name, imageUrl: imageUrl || '', addedAt: serverTimestamp(), sellerId: product.sellerId }, { merge: true });
    toast({ title: 'Added to Cart', description: `${product.name} has been added.` });
  };
  return <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-black/60 backdrop-blur-md border border-primary/50 p-3 rounded-2xl flex items-center gap-3 w-72 shadow-2xl ring-1 ring-white/5">
    <div className="relative h-16 w-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/5 bg-black">{imageUrl ? <Image src={imageUrl} alt={product.name || 'Pinned product'} fill className="object-cover" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[8px] text-neutral-500">No image</span>}</div>
    <div className="flex-1 overflow-hidden"><p className="text-[8px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">PINNED ITEM</p><p className="text-xs font-bold text-white truncate leading-tight mb-1">{product.name}</p><p className="text-base font-black text-primary tracking-tighter">${product.price.toLocaleString()}</p></div>
    {user ? <Button size="icon" className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 border-none" onClick={handleAddToCart}><ShoppingBag className="h-4 w-4" /></Button> : <Button asChild size="icon" className="h-10 w-10 shrink-0 bg-white text-black hover:bg-neutral-200 rounded-xl shadow-lg border-none"><Link href="/login" title="Sign in to buy"><LogIn className="h-4 w-4" /></Link></Button>}
  </motion.div>;
}
