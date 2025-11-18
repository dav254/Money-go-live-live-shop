

'use client';

import type { Product } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Link from 'next/link';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, serverTimestamp, increment, writeBatch, addDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface ProductDrawerProps {
  product: Product;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ProductDrawer({ product, isOpen, onOpenChange }: ProductDrawerProps) {
  const imageUrl = product.image?.imageUrl || product.imageUrl || getPlaceholderImage();
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
      buyerId: user.uid, // Add buyerId for querying
      quantity: increment(1), // Atomically increment quantity
      price: product.price,
      name: product.name || '', // Fallback to empty string if name is undefined
      imageUrl: imageUrl,
      addedAt: serverTimestamp(),
    };

    setDoc(cartItemRef, cartItemData, { merge: true }).catch(error => {
        errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
            path: cartItemRef.path,
            operation: 'write',
            requestResourceData: cartItemData,
        })
        )
    });

    // Also increment the inCartCount on the product itself
    const productRef = doc(firestore, 'products', product.id);
    updateDoc(productRef, {
        inCartCount: increment(1)
    }).catch(error => {
         errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
            path: productRef.path,
            operation: 'update',
            requestResourceData: { inCartCount: 'increment' },
        })
        )
    });


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
    
    // Create a new document reference with an auto-generated ID
    const newOrderRef = doc(ordersCollectionRef);

    const newOrderData = {
        id: newOrderRef.id, // Store the ID within the document
        buyerId: user.uid,
        sellerId: product.sellerId,
        productId: product.id,
        productName: product.name,
        productImage: imageUrl,
        totalAmount: product.price,
        orderDate: serverTimestamp(),
        shippingAddress: '123 Placeholder Lane, Nairobi', // Placeholder
        orderStatus: 'pending',
        paymentMethod: 'pending',
        quantity: 1, // Assuming quantity of 1 for "Buy Now"
    };

    try {
      // Use setDoc with the pre-generated ref
      await setDoc(newOrderRef, newOrderData);

      toast({
        title: 'Order Created!',
        description: 'Redirecting you to checkout...',
      });
      
      router.push(`/checkout/${newOrderRef.id}`);

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
                <Image 
                  src={imageUrl} 
                  alt={product.name || 'Product Image'} 
                  fill 
                  className="object-cover" 
                  data-ai-hint={imageHint}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-headline text-lg font-semibold">{product.name}</h3>
                <div className="text-xl font-bold text-primary mt-1">
                  {product.price.toLocaleString()}
                  {product.originalPrice && (
                    <span className="ml-2 text-sm text-muted-foreground line-through">
                      {product.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
                 <p className="text-sm text-muted-foreground mt-1">
                  Only {product.stock} left in stock!
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
               <Button size="lg" className="w-full font-bold text-lg" onClick={handleBuyNow}>Buy Now</Button>
               <Button size="lg" variant="secondary" className="w-full font-bold text-lg" onClick={handleAddToCart}>Add to Cart</Button>
               <Button size="lg" variant="link" asChild>
                  <Link href={`/sellers/${product.sellerId}`}>Visit Shop</Link>
                </Button>
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
