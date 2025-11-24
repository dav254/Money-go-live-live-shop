
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { db } from '@/firebase/server';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import type { Product, Seller, UserProfile, SellerShop, Review } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare, ShoppingCart, Store, Zap, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ProductPageSkeleton = () => (
    <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div>
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="mt-4 grid grid-cols-5 gap-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-md" />)}
            </div>
        </div>
        <div className="space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
            <Separator />
            <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
    </div>
);

const ReviewSection = ({ reviews }: { reviews: Review[] }) => (
    <div className="space-y-6">
        {reviews.map(review => (
            <div key={review.id} className="flex gap-4">
                <Avatar>
                    <AvatarImage src={`https://picsum.photos/seed/${review.buyerId}/40/40`} />
                    <AvatarFallback>{review.buyerId.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">User {review.buyerId.slice(0, 5)}</p>
                    <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}`} />)}
                    </div>
                    <p className="mt-2 text-muted-foreground">{review.comment}</p>
                </div>
            </div>
        ))}
    </div>
)


export default function ProductDetailPage() {
    const params = useParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const { user } = useUser();

    const productRef = useMemoFirebase(() => doc(firestore, 'products', productId), [firestore, productId]);
    const { data: product, isLoading: isProductLoading, error: productError } = useDoc<Product>(productRef);

    const sellerShopRef = useMemoFirebase(() => {
        if (!product?.sellerId) return null;
        return doc(firestore, 'sellerShops', product.sellerId);
    }, [firestore, product]);
    
    const { data: seller, isLoading: isSellerLoading } = useDoc<SellerShop>(sellerShopRef);

    const reviewsQuery = useMemoFirebase(() => {
        if (!productId) return null;
        return query(collection(firestore, 'products', productId, 'reviews'));
    }, [firestore, productId]);

    const { data: reviews, isLoading: areReviewsLoading } = useCollection<Review>(reviewsQuery);
    
    const isLoading = isProductLoading || isSellerLoading || areReviewsLoading;

    const handleAddToCart = () => {
        if (!user) {
            toast({ title: 'Please log in to add items to your cart.', action: <Button onClick={() => router.push('/login')}>Login</Button> });
            return;
        }
        if (!product) return;
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
        const cartItemData = {
            productId: product.id,
            sellerId: product.sellerId,
            quantity: increment(1),
            price: product.price,
            name: product.name,
            imageUrl: product.imageUrl,
            addedAt: serverTimestamp(),
        };
        setDoc(cartItemRef, cartItemData, { merge: true });
        toast({ title: "Added to Cart!", description: `${product.name} has been added to your cart.` });
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="container mx-auto max-w-5xl py-12">
                    <ProductPageSkeleton />
                </div>
            </MainLayout>
        );
    }
    
    if (!product) {
        return (
            <MainLayout>
                <div className="container text-center py-12">
                    <h1 className="text-2xl font-bold">Product not found.</h1>
                </div>
            </MainLayout>
        )
    }

    const isOutOfStock = product.stock <= 0;
    const allImages = [product.imageUrl, ...(product.imageUrls || [])].filter(Boolean) as string[];

    return (
        <MainLayout>
            <div className="container mx-auto max-w-5xl py-8 md:py-12">
                <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                    {/* Image Gallery */}
                    <div>
                        <div className="aspect-square w-full rounded-lg overflow-hidden border">
                            <Image src={allImages[0] || 'https://picsum.photos/seed/product/600'} alt={product.name || ''} width={600} height={600} className="w-full h-full object-cover" />
                        </div>
                        <div className="mt-4 grid grid-cols-5 gap-2">
                            {allImages.slice(0, 5).map((img, i) => (
                                <div key={i} className="aspect-square w-full rounded-md overflow-hidden border-2 border-transparent hover:border-primary">
                                    <Image src={img} alt={`${product.name} thumbnail ${i+1}`} width={100} height={100} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Product Details */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                             <h1 className="font-headline text-3xl font-bold">{product.name}</h1>
                             <div className="flex items-center gap-2">
                                <span className="text-3xl font-bold text-primary">${product.price.toLocaleString()}</span>
                                {product.wasPrice && <span className="text-xl text-muted-foreground line-through">${product.wasPrice.toLocaleString()}</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                <span>{product.rating || 'N/A'} ({reviews?.length || 0} reviews)</span>
                            </div>
                            <span>&middot;</span>
                            <span>{product.inCartCount || 0} sold</span>
                             <span>&middot;</span>
                            <Badge variant={isOutOfStock ? 'destructive' : 'secondary'}>{isOutOfStock ? 'Out of Stock' : 'In Stock'}</Badge>
                        </div>
                        <p className="text-base leading-relaxed">{product.description}</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button size="lg" className="w-full" onClick={handleAddToCart} disabled={isOutOfStock}><ShoppingCart className="mr-2 h-5 w-5"/> Add to Cart</Button>
                            <Button size="lg" variant="secondary" className="w-full" disabled={isOutOfStock}>Buy Now</Button>
                        </div>
                        <Separator />
                         <Link href={`/sellers/${product.sellerId}`} className="block">
                            <div className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted transition-colors">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={seller?.logoUrl} />
                                    <AvatarFallback>{seller?.shopName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-bold">{seller?.shopName}</p>
                                    <p className="text-sm text-muted-foreground">{seller?.followers || 0} Followers</p>
                                </div>
                                <Button variant="outline"><Store className="mr-2 h-4 w-4"/> Visit Shop</Button>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Reviews Section */}
                <div className="mt-12 md:mt-16">
                     <h2 className="font-headline text-2xl font-bold mb-6">Reviews ({reviews?.length || 0})</h2>
                     {areReviewsLoading ? <Skeleton className="h-32 w-full" /> : 
                        reviews && reviews.length > 0 ? <ReviewSection reviews={reviews} /> :
                        <p className="text-muted-foreground">No reviews for this product yet.</p>
                     }
                </div>

            </div>
        </MainLayout>
    );
}
