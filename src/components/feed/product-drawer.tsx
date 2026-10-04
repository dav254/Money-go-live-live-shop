
'use client';

import type { Product } from '@/lib/types';
import { isService, ListingPrice, ServiceBadge } from '@/components/listings/service-badge';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Link from 'next/link';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, serverTimestamp, increment, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface ProductDrawerProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /**
   * Where "Visit Shop" goes. Required, with no default, for the same reason
   * `ProductInfo.appHref` is: the previous hard-coded `/sellers/{sellerId}` is
   * exactly the escape this prop exists to remove.
   *
   * The app has no single-seller storefront, so the app feed cannot honestly
   * supply one here. It passes the product's own screen instead, which is the
   * closest in-app destination and keeps the tap inside the section.
   */
  shopHref: string;
  /**
   * Where "Buy now" goes once the order document has been created. Takes the
   * new order id because the website needs it for `/checkout/[orderId]`; the
   * app ignores it and sends the buyer to its own cart.
   */
  checkoutHrefFor: (orderId: string) => string;
  /**
   * Label for that link. It defaults to "Visit Shop", which is accurate only
   * when `shopHref` really is the seller's storefront. The app feed sends the
   * tap to the product's own screen, so it passes "View product" — a button
   * that says one thing and does another is its own small lie.
   */
  shopLabel?: string;
  /**
   * Where "Ask for a quote" goes. Only used for services — a service is
   * booked by talking to the seller, so there is nothing meaningful to add to
   * a cart. Optional because products never render that button.
   */
  messageHref?: string;
}

export function ProductDrawer({
  product,
  isOpen,
  onOpenChange,
  shopHref,
  checkoutHrefFor,
  shopLabel = 'Visit Shop',
  messageHref,
}: ProductDrawerProps) {
  const service = isService(product);
  const imageUrl = (product.imageUrl && product.imageUrl !== "") ? product.imageUrl : getPlaceholderImage();
  const imageHint = product.image?.imageHint || 'product image';
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

    const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
    
    const cartItemData = {
      productId: product.id,
      sellerId: product.sellerId,
      buyerId: user.uid,
      quantity: increment(1),
      price: product.price,
      name: product.name || '',
      imageUrl: imageUrl,
      addedAt: serverTimestamp(),
    };

    try {
        setDoc(cartItemRef, cartItemData, { merge: true });
    } catch(e) {
         errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: cartItemRef.path,
                operation: 'write',
                requestResourceData: cartItemData,
            })
        )
    }

    toast({
      title: 'Added to Cart',
      description: `${product.name} has been added to your cart.`,
    });
  };

  const handleBuyNow = async () => {
     if (!user) {
      toast({
        title: 'Please log in',
        description: 'You need to be logged in to purchase an item.',
        action: <Button onClick={() => router.push('/login')}>Login</Button>,
      });
      return;
    }

    const ordersCollectionRef = collection(firestore, 'orders');
    const newOrderRef = doc(ordersCollectionRef);
    const shippingCost = product.shippingCost || 0;
    const productPrice = product.price || 0;

    const newOrderData = {
        id: newOrderRef.id,
        buyerId: user.uid,
        sellerId: product.sellerId,
        productId: product.id,
        productName: product.name || '',
        productImage: imageUrl || '',
        productPrice: productPrice,
        shippingCost: shippingCost,
        totalAmount: productPrice + shippingCost,
        orderDate: serverTimestamp(),
        shippingAddress: '123 Placeholder Lane, Nairobi',
        orderStatus: 'pending',
        paymentMethod: 'pending',
        quantity: 1,
    };

    try {
      await setDoc(newOrderRef, newOrderData);        toast({
          title: 'Order Created!',
          description: 'Redirecting you to checkout...',
        });
        // `checkoutHrefFor` is resolved by the caller: the website has
        // `/checkout/[orderId]`, the app does not and sends the buyer to its own
        // cart. Hard-coding the website path here was an app escape.
        router.push(checkoutHrefFor(newOrderRef.id));
    } catch (error) {
       console.error("Failed to place order:", error);
       const permissionError = new FirestorePermissionError({
          path: newOrderRef.path,
          operation: 'create',
          requestResourceData: newOrderData
       });
       errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card/95 text-card-foreground border-t-primary border-t-2 rounded-t-2xl backdrop-blur-md">
        <SheetHeader>
          <SheetTitle className="font-headline text-lg text-primary">Featured Product</SheetTitle>
        </SheetHeader>
        <div className="py-4">
            <div className="flex items-start gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-lg">
                {imageUrl && (
                  <Image 
                    src={imageUrl} 
                    alt={product.name || 'Product Image'} 
                    fill 
                    className="object-cover" 
                    data-ai-hint={imageHint}
                  />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-headline text-lg font-semibold">{product.name}</h3>

                {/* A service is work, not goods: no stock line, and the price
                    reads as a quote prompt or an hourly rate rather than a
                    number the seller never agreed to. */}
                {service ? (
                  <>
                    <div className="mt-1.5"><ServiceBadge listing={product} tone="light" /></div>
                    <ListingPrice listing={product} className="mt-1.5 text-xl font-bold" tone="light" />
                    {product.serviceArea && (
                      <p className="text-sm text-muted-foreground mt-1.5">
                        Covers {product.serviceArea}
                      </p>
                    )}
                    {product.includes && (
                      <p className="text-sm text-muted-foreground mt-1">{product.includes}</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-xl font-bold text-primary mt-1">
                      ${product.price.toLocaleString()}
                      {product.wasPrice && (
                        <span className="ml-2 text-sm text-muted-foreground line-through">
                          ${product.wasPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Only {product.stock} left in stock!
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
               {/*
                 A service cannot be added to a cart and paid for like a
                 sofa — the price is a quote the two sides agree after a
                 conversation. Sending a buyer to checkout for "KES 0" would be
                 worse than offering them the obvious next step: message the
                 seller. The order/cart flows are untouched for products.
               */}
               {service ? (
                 <>
                   <Button size="lg" variant="link" asChild>
                     <Link href={messageHref || shopHref}>
                       {product.priceMode === 'quote' ? 'Ask for a quote' : 'Book this service'}
                     </Link>
                   </Button>
                   <Button size="lg" variant="link" asChild>
                     <Link href={shopHref}>{shopLabel}</Link>
                   </Button>
                 </>
               ) : (
                 <>
                   <Button size="lg" className="w-full font-bold text-lg" onClick={handleBuyNow}>Buy Now</Button>
                   <Button size="lg" variant="secondary" className="w-full font-bold text-lg" onClick={handleAddToCart}>Add to Cart</Button>
                   <Button size="lg" variant="link" asChild>
                      <Link href={shopHref}>{shopLabel}</Link>
                    </Button>
                 </>
               )}
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
