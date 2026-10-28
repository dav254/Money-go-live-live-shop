
'use client';

import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Eye, Video, Tag } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { mirrorCartItem } from '@/lib/users/mirror';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';

interface ProductCardProps {
  product: Product;
  /**
   * `shop` applies the seller-shop presentation (dark navy card, red price,
   * full-width Add to Cart) while keeping EVERY existing behaviour — link,
   * like, cart, stock check, media fallback. `default` is untouched, so feeds
   * and search results render exactly as before.
   */
  variant?: 'default' | 'shop';
}

export function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const isShop = variant === 'shop';
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const discountPercentage = product.wasPrice && product.price ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100) : 0;
  
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const handleAddToCart = () => {
    if (!user) {
      toast({
        title: 'Please log in',
        description: 'You need to be logged in to add items to your cart.',
        action: <Button onClick={() => router.push('/login')}>Login</Button>,
      });
      return;
    }

    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection not available.' });
      return;
    }
    
    const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
    
    const cartItemData = {
      productId: product.id,
      sellerId: product.sellerId,
      buyerId: user.uid,
      quantity: increment(1),
      price: product.price,
      name: product.name || '',
      imageUrl: product.imageUrl || getPlaceholderImage(),
      addedAt: serverTimestamp(),
    };

    setDoc(cartItemRef, cartItemData, { merge: true })
      .then(() => mirrorCartItem(user, product.id))
      .catch(error => {
        errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
            path: cartItemRef.path,
            operation: 'write',
            requestResourceData: cartItemData,
        })
        )
    });

    toast({
      title: 'Added to Cart!',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleLike = () => {
    if (!firestore) return;
    const productRef = doc(firestore, 'products', product.id);

    const batch = writeBatch(firestore);
    batch.update(productRef, { likes: increment(1) });
    batch.commit().catch(console.error);

    toast({
        title: "Liked!",
        description: "You liked this product.",
    });
  };
  
  const hasVideo = !!(product.videoUrl || (product.videoUrls && product.videoUrls.length > 0));
  const mainImage = product.imageUrl && product.imageUrl.trim() !== "" ? product.imageUrl : getPlaceholderImage();
  // Stored media can become unreachable (e.g. the Firebase bucket is no longer
  // served on the free plan) — swap in the neutral placeholder instead of
  // showing a broken image.
  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    const el = event.currentTarget;
    if (el.dataset.fallbackApplied === 'true') return;
    el.dataset.fallbackApplied = 'true';
    el.src = getPlaceholderImage();
  };

  return (
    <div className={cn(
      'bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden group text-white h-full flex flex-col shadow-lg transition-all hover:border-primary/50',
      isShop && 'rounded-2xl border-white/10 bg-[#0B1220] shadow-[0_16px_34px_-22px_rgba(0,0,0,0.95)] hover:border-[#FF0033]/70',
    )}>
      <div className="relative">
        <Link href={`/products/${product.id}`} className="cursor-pointer">
            <div className={cn('w-full h-48 bg-black relative', isShop && 'h-44 sm:h-56')}>
                {hasVideo ? (
                <video
                    src={
                      product.videoUrl && product.videoUrl.trim() !== ""
                        ? product.videoUrl
                        : product.videoUrls?.[0] && product.videoUrls[0].trim() !== ""
                          ? product.videoUrls[0]
                          : getPlaceholderImage()
                    }
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    poster={mainImage}
                    onError={handleImageError}
                    muted
                    loop
                    playsInline
                    onMouseOver={e => e.currentTarget.play()}
                    onMouseOut={e => e.currentTarget.pause()}
                />
                ) : (
                     <img
                        src={mainImage}
                        alt={product.name || 'Product image'}
                        onError={handleImageError}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                )}
            </div>
             {hasVideo && (
                <div className="absolute top-2 left-2 bg-black/50 text-white p-1 rounded-full">
                    <Video className="h-4 w-4" />
                </div>
            )}
        </Link>
        {discountPercentage > 0 && (
          <div className={cn(
            'absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-xl',
            isShop && 'right-auto left-2 rounded-full bg-gradient-to-r from-[#FF0033] to-[#FF2D55] shadow-[0_0_14px_rgba(255,0,51,0.6)]',
          )}>
            {discountPercentage}% OFF
          </div>
        )}
        
        {product.condition && (
            <div className={cn(
                "absolute bottom-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-lg",
                product.condition === 'new' ? "bg-green-600 text-white" : "bg-yellow-600 text-black"
            )}>
                {product.condition === 'new' ? 'New' : 'Used'}
            </div>
        )}

        <Button onClick={handleLike} size="icon" variant="ghost" aria-label="Like this product" className={cn(
          'absolute top-2 right-2 bg-black/50 text-white rounded-full h-8 w-8 hover:bg-black/70',
          isShop && 'border border-white/15 bg-black/60 hover:bg-[#FF0033]',
        )}>
          <Heart className="h-4 w-4" />
        </Button>
        {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold uppercase text-xs">Out of Stock</span>
            </div>
        )}
      </div>
      <div className={cn('p-3 flex-1 flex flex-col', isShop && 'p-3.5')}>
        <h3 className={cn('text-sm font-semibold truncate group-hover:text-primary', isShop && 'text-white group-hover:text-[#FF2D55]')}>
            <Link href={`/products/${product.id}`}>{product.name}</Link>
        </h3>

        {/* Existing product description, used as the card subtitle */}
        {isShop && product.description && (
          <p className="mt-0.5 truncate text-[11px] text-neutral-400">{product.description}</p>
        )}

        <div className="mt-1 space-y-1">
          {/* LOCAL SALE PRICE */}
          <div className="flex items-center gap-1">
             {!isShop && <Tag className="h-3 w-3 text-primary" />}
             <span className={cn(
               'text-lg font-black text-primary tracking-tighter',
               isShop && 'text-[#FF2D55]',
             )}>
                {product.localCurrency || 'USD'} {(product.localPrice || product.price)?.toLocaleString()}
             </span>
          </div>

          {/* MARKET PRICE */}
          {product.wasPrice && (
            <div className="flex items-center gap-2 opacity-60">
                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-tighter line-through">
                    MARKET: ${product.wasPrice.toLocaleString()}
                </span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-3 flex gap-2">
            <Button onClick={handleAddToCart} disabled={isOutOfStock} size="sm" className={cn(
              'flex-1 bg-primary hover:bg-primary/90 text-white font-black text-[10px] uppercase',
              isShop && 'h-9 rounded-xl bg-[#FF0033] text-xs tracking-wider hover:bg-[#e6002d] shadow-[0_0_16px_-4px_rgba(255,0,51,0.7)]',
            )}>
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> {isShop ? 'ADD TO CART' : 'ADD'}
            </Button>
            {!isShop && (
              <Button asChild size="icon" variant="outline" className="shrink-0 border-neutral-700 hover:bg-neutral-800">
                  <Link href={`/products/${product.id}`}><Eye className="h-4 w-4" /></Link>
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}
