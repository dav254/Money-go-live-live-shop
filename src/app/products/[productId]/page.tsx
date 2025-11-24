
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useParams, useRouter } from 'next/navigation';
import type { Product, SellerShop, UserProfile, Review } from '@/lib/types';
import { doc, collection, query, where, collectionGroup, setDoc, increment, serverTimestamp, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ProductCard } from '@/components/seller/product-card';
import {
  Star,
  ShieldCheck,
  Truck,
  MapPin,
  MessageSquare,
  Plus,
  Share2,
  Bookmark,
  ShoppingCart,
  Zap,
  ChevronDown,
  Store,
  Heart,
  HelpCircle,
  Award,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { Progress } from '@/components/ui/progress';

const ProductPageSkeleton = () => (
    <MainLayout>
        <div className="container mx-auto max-w-4xl py-8 space-y-8">
            <Skeleton className="w-full aspect-square md:aspect-[16/9] rounded-lg" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/4" />
            </div>
            <Skeleton className="h-12 w-1/2" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    </MainLayout>
);

const StarRating = ({ rating, count, starSize = 'h-4 w-4' }: { rating: number, count?: number, starSize?: string }) => (
    <div className="flex items-center gap-1">
        <div className="flex items-center text-yellow-400">
            {[...Array(5)].map((_, i) => (
                <Star key={i} className={`${starSize} ${i < Math.round(rating) ? 'fill-current' : ''}`} />
            ))}
        </div>
        {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
    </div>
);


export default function BuyerProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);

    // Data Fetching
    const productRef = useMemoFirebase(() => {
      if (!firestore || !productId) return null;
      return doc(firestore, 'products', productId);
    }, [firestore, productId]);
    
    const { data: product, isLoading: isProductLoading, error: productError } = useDoc<Product>(productRef);

    const sellerShopRef = useMemoFirebase(() => {
        if (!firestore || !product?.sellerId) return null;
        return doc(firestore, 'sellerShops', product.sellerId);
    }, [firestore, product]);
    
    const { data: seller, isLoading: isSellerLoading } = useDoc<SellerShop>(sellerShopRef);
    
    const reviewsQuery = useMemoFirebase(() => {
        if (!firestore || !productId) return null;
        return query(collectionGroup(firestore, 'reviews'), where('productId', '==', productId));
    }, [firestore, productId]);
    const { data: reviews, isLoading: areReviewsLoading } = useCollection<Review>(reviewsQuery);
    
    const otherProductsQuery = useMemoFirebase(() => {
        if (!firestore || !product?.sellerId) return null;
        return query(collection(firestore, 'products'), where('sellerId', '==', product.sellerId));
    }, [firestore, product]);

    const { data: otherProducts, isLoading: areOtherProductsLoading } = useCollection<Product>(otherProductsQuery);


    // State
    const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);

    const allMedia = useMemo(() => {
        if (!product) return [];
        const media: { url: string; type: 'image' | 'video' }[] = [];
        if (product.videoUrls) media.push(...product.videoUrls.map(url => ({ url, type: 'video' as 'video' })));
        if (product.imageUrls) media.push(...product.imageUrls.map(url => ({ url, type: 'image' as 'image' })));
        if (product.imageUrl && !product.imageUrls?.includes(product.imageUrl)) media.unshift({ url: product.imageUrl, type: 'image' });
        return media;
    }, [product]);
    
    useEffect(() => {
        if (allMedia.length > 0 && !selectedMedia) {
            setSelectedMedia(allMedia[0]);
        }
    }, [allMedia, selectedMedia]);
    
    useEffect(() => {
      if (userProfile && userProfile.following && product) {
        setIsFollowing(userProfile.following.includes(product.sellerId));
      }
    }, [userProfile, product]);


    const handleAddToCart = () => {
        if (!user || !firestore || !product) {
          toast({ title: 'Please log in', description: 'You need to be logged in to add items to your cart.', action: <Button onClick={() => router.push('/login')}>Login</Button> });
          return;
        }
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
        const cartItemData = {
          productId: product.id, sellerId: product.sellerId, buyerId: user.uid, quantity: increment(1), price: product.price, name: product.name || '', imageUrl: product.imageUrl || '', addedAt: serverTimestamp(),
        };
        setDoc(cartItemRef, cartItemData, { merge: true });
        toast({ title: 'Added to Cart', description: `${product.name} has been added to your cart.` });
    };

    const handleBuyNow = async () => {
        if (!user || !firestore || !product) {
          toast({ title: 'Please log in', description: 'You need to be logged in to purchase.', action: <Button onClick={() => router.push('/login')}>Login</Button> });
          return;
        }
        const newOrderRef = doc(collection(firestore, 'orders'));
        const newOrderData = {
            id: newOrderRef.id, buyerId: user.uid, sellerId: product.sellerId, productId: product.id, productName: product.name || '', productImage: product.imageUrl || '', productPrice: product.price, shippingCost: product.shippingCost || 0, totalAmount: (product.price || 0) + (product.shippingCost || 0), orderDate: serverTimestamp(), shippingAddress: '123 Placeholder Lane, Nairobi', orderStatus: 'pending', paymentMethod: 'pending', quantity: 1,
        };
        await setDoc(newOrderRef, newOrderData);
        router.push(`/checkout/${newOrderRef.id}`);
    };
    
    const handleFollow = async () => {
        if (!user || !firestore || !product) {
          toast({ variant: 'destructive', title: 'Please log in to follow sellers.' });
          return;
        }
        const userProfileRef = doc(firestore, 'userProfiles', user.uid);
        const newFollowingState = !isFollowing;
        await updateDoc(userProfileRef, { following: newFollowingState ? arrayUnion(product.sellerId) : arrayRemove(product.sellerId) });
        setIsFollowing(newFollowingState);
    };

    const handleChat = async () => {
        if (!user || !firestore || !product || user.uid === product.sellerId) return;
        const chatsRef = collection(firestore, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
        const querySnapshot = await getDocs(q);
        let existingChatId: string | null = null;
        querySnapshot.forEach(doc => { if (doc.data().participantIds.includes(product.sellerId)) { existingChatId = doc.id; } });
        if (existingChatId) {
            router.push(`/messages?chatWith=${product.sellerId}`);
        } else {
            const newChatRef = doc(collection(firestore, 'chats'));
            await setDoc(newChatRef, { id: newChatRef.id, participantIds: [user.uid, product.sellerId], lastMessage: `Conversation started about ${product.name}`, lastMessageTimestamp: serverTimestamp() });
            router.push(`/messages?chatWith=${product.sellerId}`);
        }
    };

    const isLoading = isProductLoading || isSellerLoading || areReviewsLoading || areOtherProductsLoading;
    
    if (isLoading) return <ProductPageSkeleton />;

    if (productError || !product) {
        return (
            <MainLayout>
                <div className="container py-12 text-center">
                    <h1 className="text-2xl font-bold">Product Not Found</h1>
                    <p className="text-muted-foreground">The product you are looking for might have been removed or is unavailable.</p>
                </div>
            </MainLayout>
        );
    }
    
    const discountPercentage = product.wasPrice && product.price ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100) : 0;
    const reviewStats = useMemo(() => {
        if (!reviews) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, average: 0 };
        const counts = reviews.reduce((acc, r) => {
            const rating = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
            acc[rating]++;
            return acc;
        }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        
        const totalReviews = reviews.length;
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        const average = totalReviews > 0 ? totalRating / totalReviews : 0;
        
        return { ...counts, average };
    }, [reviews]);


    return (
    <MainLayout>
      <div className="bg-black text-white pb-24">
        {/* 1. Product Media Section */}
        <div className="relative w-full">
            <div className="aspect-square md:aspect-[16/10] w-full bg-black">
                {selectedMedia?.type === 'video' ? (
                     <video src={selectedMedia.url} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                ) : selectedMedia?.url ? (
                    <Image src={selectedMedia.url} alt={product.name || 'Product'} fill className="object-contain" priority />
                ) : (
                    <div className="flex items-center justify-center h-full bg-muted"><p>No Media</p></div>
                )}
            </div>
            <div className="absolute top-4 right-4 flex gap-2">
                <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70"><Share2 className="h-5 w-5" /></Button>
                <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70"><Bookmark className="h-5 w-5" /></Button>
            </div>
            {discountPercentage > 0 && <Badge className="absolute top-4 left-4 bg-red-600 text-white font-bold">{discountPercentage}% OFF</Badge>}
        </div>
        {allMedia.length > 1 && (
            <div className="bg-neutral-900 py-2">
                 <Carousel opts={{ align: "start" }} className="w-full container">
                    <CarouselContent>
                    {allMedia.map((media, i) => (
                        <CarouselItem key={i} className="basis-1/4 sm:basis-1/5">
                            <div className="p-1">
                                <Card onClick={() => setSelectedMedia(media)} className={cn("overflow-hidden cursor-pointer bg-neutral-800", selectedMedia?.url === media.url && "ring-2 ring-primary")}>
                                    <CardContent className="p-0 aspect-square relative">
                                        <Image src={media.url} alt={`thumbnail ${i}`} fill className="object-cover" />
                                        {media.type === 'video' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Zap className="h-6 w-6 text-white" /></div>}
                                    </CardContent>
                                </Card>
                            </div>
                        </CarouselItem>
                    ))}
                    </CarouselContent>
                </Carousel>
            </div>
        )}

        <div className="container mx-auto max-w-4xl py-6 px-4 space-y-6">
            {/* 2. Product Title + Rating */}
            <div>
                <Link href={`/categories/${product.category}`} className="text-sm text-primary hover:underline">{product.category}</Link>
                <h1 className="font-headline text-2xl md:text-3xl font-bold">{product.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm">
                    <StarRating rating={reviewStats.average} count={reviews?.length || 0} />
                    <span className="text-muted-foreground">Sold 3.2k</span>
                </div>
            </div>

            {/* 3. Price Section */}
            <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-red-500">{product.price.toLocaleString()} KES</p>
                {product.wasPrice && <p className="text-lg text-muted-foreground line-through">{product.wasPrice.toLocaleString()} KES</p>}
            </div>

            {/* 4. Delivery & Location */}
            <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> <span>Ships from <strong>{product.location}</strong></span></div>
                    <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-muted-foreground" /> <span>Standard Delivery (1-2 days) - <strong className="text-primary">${product.shippingCost}</strong></span></div>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> <span>7-day return policy</span></div>
                </CardContent>
            </Card>

            {/* 5. Variants & Quantity */}
             <div className="flex items-center justify-between">
                <p className="font-semibold">Quantity</p>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8">-</Button>
                    <span className="w-10 text-center font-bold">1</span>
                    <Button variant="outline" size="icon" className="h-8 w-8">+</Button>
                </div>
            </div>

            {/* 6. Seller Shop Info */}
            {seller && (
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border"><AvatarImage src={seller.logoUrl} /><AvatarFallback>{seller.shopName?.charAt(0)}</AvatarFallback></Avatar>
                        <div className="flex-1">
                            <p className="font-bold">{seller.shopName}</p>
                            <p className="text-xs text-muted-foreground">{seller.followers} followers</p>
                        </div>
                        <Button onClick={handleFollow} variant={isFollowing ? 'secondary' : 'default'} size="sm">{isFollowing ? 'Following' : 'Follow'}</Button>
                        <Button variant="outline" size="sm" asChild><Link href={`/sellers/${product.sellerId}`}>Visit Shop</Link></Button>
                    </CardContent>
                </Card>
            )}

            <Accordion type="single" collapsible className="w-full" defaultValue="description">
                {/* 7. Product Description */}
                <AccordionItem value="description">
                    <AccordionTrigger>Product Description</AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert text-neutral-300">{product.description}</AccordionContent>
                </AccordionItem>
                {/* 8. Reviews & Ratings */}
                <AccordionItem value="reviews">
                    <AccordionTrigger>Reviews & Ratings ({reviews?.length || 0})</AccordionTrigger>
                    <AccordionContent>
                        <div className="flex items-start gap-6">
                            <div className="w-1/3 space-y-1">
                                <div className="flex items-center gap-2"><p className="text-4xl font-bold">{reviewStats.average.toFixed(1)}</p> <StarRating rating={reviewStats.average} starSize="h-6 w-6"/></div>
                                <p className="text-xs text-muted-foreground">Based on {reviews?.length} reviews</p>
                            </div>
                            <div className="w-2/3 space-y-1">
                                {[5, 4, 3, 2, 1].map(star => (
                                    <div key={star} className="flex items-center gap-2 text-xs">
                                        <span>{star}★</span>
                                        <Progress value={reviews ? (reviewStats[star] / reviews.length) * 100 : 0} className="h-2 w-full" />
                                        <span>{reviewStats[star]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Separator className="my-4" />
                        {reviews && reviews.length > 0 ? reviews.map(r => (
                             <div key={r.id} className="py-4 border-b last:border-b-0">
                                <div className="flex items-center gap-2 mb-1"><Avatar className="h-6 w-6"><AvatarFallback>B</AvatarFallback></Avatar><p className="text-xs font-semibold">A Buyer</p></div>
                                <StarRating rating={r.rating} />
                                <p className="mt-2 text-sm">{r.comment}</p>
                            </div>
                        )) : <p className="text-muted-foreground text-sm text-center py-8">No reviews yet.</p>}
                    </AccordionContent>
                </AccordionItem>
                {/* 9. Q&A */}
                <AccordionItem value="qa">
                    <AccordionTrigger>Questions & Answers</AccordionTrigger>
                    <AccordionContent><p className="text-muted-foreground text-sm text-center py-8">No questions have been asked yet.</p></AccordionContent>
                </AccordionItem>
            </Accordion>
            
            {/* 10. Recommended From This Seller */}
            <div>
                 <h2 className="font-headline text-xl font-bold mt-8 mb-4">More from {seller?.shopName}</h2>
                <ProductGrid products={otherProducts?.filter(p => p.id !== productId).slice(0, 4) || []} />
            </div>
        </div>
      </div>

      {/* 12. Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/80 backdrop-blur-sm border-t border-neutral-800 p-2 flex items-center gap-2">
            <Button variant="ghost" size="icon"><Heart className="h-5 w-5"/></Button>
            <Button variant="ghost" size="icon" onClick={handleChat}><MessageSquare className="h-5 w-5" /></Button>
            <Button variant="secondary" className="flex-1" onClick={handleAddToCart}>Add to Cart</Button>
            <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleBuyNow}>Buy Now</Button>
      </div>
    </MainLayout>
  );
}
