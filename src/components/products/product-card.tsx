'use client';

import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Eye, Video, Tag } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ProductCardProps { product: Product; }

export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const discountPercentage = product.wasPrice && product.price ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100) : 0;
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
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
    const cartItemData = { productId: product.id, sellerId: product.sellerId, buyerId: user.uid, quantity: increment(1), price: product.price, name: product.name || '', imageUrl: product.imageUrl?.trim() || '', addedAt: serverTimestamp() };
    setDoc(cartItemRef, cartItemData, { merge: true }).catch((error) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: cartItemRef.path, operation: 'write', requestResourceData: cartItemData })));
    toast({ title: 'Added to Cart!', description: `${product.name} has been added to your cart.` });
  };

  const handleLike = () => {
    if (!firestore) return;
    writeBatch(firestore).update(doc(firestore, 'products', product.id), { likes: increment(1) }).commit().catch(console.error);
    toast({ title: 'Liked!', description: 'You liked this product.' });
  };

  const hasVideo = Boolean(product.videoUrl?.trim() || product.videoUrls?.some((url) => url?.trim()));
  const mainImage = product.imageUrl?.trim();

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden group text-white h-full flex flex-col shadow-lg transition-all hover:border-primary/50">
      <div className="relative">
        <Link href={`/products/${product.id}`} className="cursor-pointer">
          <div className="relative flex h-48 w-full items-center justify-center bg-black">
            {hasVideo ? <video src={product.videoUrl?.trim() || product.videoUrls?.find((url) => url?.trim())} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" poster={mainImage || undefined} muted loop playsInline onMouseOver={(e) => e.currentTarget.play()} onMouseOut={(e) => e.currentTarget.pause()} /> : mainImage ? <img src={mainImage} alt={product.name || 'Product image'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <span className="px-4 text-center text-xs font-medium text-neutral-500">No image or video uploaded.</span>}
          </div>
          {hasVideo && <div className="absolute left-2 top-2 rounded-full bg-black/50 p-1 text-white"><Video className="h-4 w-4" /></div>}
        </Link>
        {discountPercentage > 0 && <div className="absolute right-2 top-2 rounded bg-red-500 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-xl">{discountPercentage}% OFF</div>}
        {product.condition && <div className={cn('absolute bottom-2 left-2 rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-widest shadow-lg', product.condition === 'new' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-black')}>{product.condition === 'new' ? 'New' : 'Used'}</div>}
        <Button onClick={handleLike} size="icon" variant="ghost" className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"><Heart className="h-4 w-4" /></Button>
        {isOutOfStock && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><span className="text-xs font-bold uppercase text-white">Out of Stock</span></div>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="truncate text-sm font-semibold group-hover:text-primary"><Link href={`/products/${product.id}`}>{product.name}</Link></h3>
        <div className="mt-1 space-y-1"><div className="flex items-center gap-1"><Tag className="h-3 w-3 text-primary" /><span className="text-lg font-black tracking-tighter text-primary">{product.localCurrency || 'USD'} {(product.localPrice || product.price)?.toLocaleString()}</span></div>{product.wasPrice && <div className="flex items-center gap-2 opacity-60"><span className="text-[11px] font-black uppercase tracking-tighter text-neutral-500 line-through">MARKET: ${product.wasPrice.toLocaleString()}</span></div>}</div>
        <div className="mt-auto flex gap-2 pt-3"><Button onClick={handleAddToCart} disabled={isOutOfStock} size="sm" className="flex-1 bg-primary text-[10px] font-black uppercase text-white hover:bg-primary/90"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />ADD</Button><Button asChild size="icon" variant="outline" className="shrink-0 border-neutral-700 hover:bg-neutral-800"><Link href={`/products/${product.id}`}><Eye className="h-4 w-4" /></Link></Button></div>
      </div>
    </div>
  );
}
