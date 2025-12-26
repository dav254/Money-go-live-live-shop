

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Star, ShieldCheck, Truck, MapPin, MessageSquare, Plus, Share2, Store, Heart, Zap, Video, ShoppingCart, Eye, Tag } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { cn } from '@/lib/utils';
import type { Product, SellerShop, UserProfile, Review } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase, useUser, errorEmitter, useUserProfile, useCollection } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp, collection, updateDoc, arrayUnion, arrayRemove, writeBatch, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { formatDistanceToNow } from 'date-fns';


const StarRating = ({ rating, count }: { rating: number, count?: number }) => (
    <div className="flex items-center gap-2">
        <div className="flex items-center text-yellow-400">
            {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.round(rating) ? 'fill-current' : ''}`} />
            ))}
        </div>
        {count !== undefined && <span className="text-xs text-neutral-400">({count} ratings)</span>}
    </div>
);

const ProductPageSkeleton = () => (
    <div className="bg-black text-white pb-24">
        <div className="relative w-full aspect-square md:aspect-[16/10] bg-neutral-900">
            <Skeleton className="w-full h-full" />
        </div>
        <div className="bg-neutral-900 py-2">
             <div className="container px-0 flex gap-1">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-1/4" />)}
            </div>
        </div>
        <div className="container mx-auto max-w-4xl py-6 px-4 space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-48" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-28 w-full" />
             <Skeleton className="h-12 w-full" />
        </div>
    </div>
);

const ReviewCard = ({ review }: { review: Review }) => {
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', review.buyerId), [firestore, review.buyerId]);
    const { data: userProfile, isLoading } = useDoc<UserProfile>(userProfileRef);

    return (
        <div className="flex gap-4 border-b border-neutral-800 py-4 last:border-b-0">
             <Avatar className="h-8 w-8 border">
                <AvatarImage src={userProfile?.profilePictureUrl} />
                <AvatarFallback>{userProfile?.fullName?.charAt(0) || 'A'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{userProfile?.fullName || 'Anonymous'}</p>
                    <p className="text-xs text-neutral-400">{formatDistanceToNow(review.createdAt.toDate(), { addSuffix: true })}</p>
                </div>
                <div className="my-1">
                    <StarRating rating={review.rating} />
                </div>
                <p className="text-sm text-neutral-300">{review.comment}</p>
            </div>
        </div>
    );
};


export default function BuyerProductPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { user } = useUser();
    const { userProfile } = useUserProfile(user?.uid);
    const { toast } = useToast();
    const router = useRouter();

    // This effect runs when the component mounts, which is when a video is viewed.
    useEffect(() => {
        if (firestore && productId) {
        const productRef = doc(firestore, 'products', productId);
        // We use a non-blocking update for performance. This is a "fire-and-forget" operation.
        updateDoc(productRef, { viewCount: increment(1) }).catch(console.error);
        }
    }, [firestore, productId]);

    // Capture reseller ref from URL and store it in localStorage
    useEffect(() => {
        const resellerRef = searchParams.get('ref');
        if (resellerRef) {
            localStorage.setItem('resellerRefId', resellerRef);
        }
    }, [searchParams]);

    const productRef = useMemoFirebase(() => {
        return productId ? doc(firestore, 'products', productId) : null;
    }, [firestore, productId]);

    const { data: product, isLoading: isProductLoading } = useDoc<Product>(productRef);
    
    // Fetch seller data
    const sellerId = product?.sellerId;
    const sellerShopRef = useMemoFirebase(() => {
        return sellerId ? doc(firestore, 'sellerShops', sellerId) : null;
    }, [firestore, sellerId]);
    const sellerProfileRef = useMemoFirebase(() => {
        return sellerId ? doc(firestore, 'userProfiles', sellerId) : null;
    }, [firestore, sellerId]);

    const { data: sellerShop, isLoading: isSellerShopLoading } = useDoc<SellerShop>(sellerShopRef);
    const { data: sellerProfile, isLoading: isSellerProfileLoading } = useDoc<UserProfile>(sellerProfileRef);

    const reviewsQuery = useMemoFirebase(() => {
        if (!productId) return null;
        return query(collection(firestore, 'products', productId, 'reviews'), orderBy('createdAt', 'desc'));
    }, [firestore, productId]);
    const { data: reviews, isLoading: areReviewsLoading } = useCollection<Review>(reviewsQuery);
    
    const recommendedProductsQuery = useMemoFirebase(() => {
        if (!product) return null;
        return query(collection(firestore, 'products'), where('category', '==', product.category), limit(5));
    }, [firestore, product]);
    const { data: recommendedProducts, isLoading: areRecsLoading } = useCollection<Product>(recommendedProductsQuery);

    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {
        if (userProfile && userProfile.following && sellerId) {
        setIsFollowing(userProfile.following.includes(sellerId));
        }
    }, [userProfile, sellerId]);


    const allMedia = useMemo(() => {
        if (!product) return [];
        
        const media = [];
        // Prioritize video
        if (product.videoUrl) media.push({ url: product.videoUrl, type: 'video' as 'video' });
        if (product.videoUrls) media.push(...product.videoUrls.map(url => ({ url, type: 'video' as 'video' })));
        
        // Then add images
        if (product.imageUrl) media.push({ url: product.imageUrl, type: 'image' as 'image' });
        if (product.imageUrls) media.push(...product.imageUrls.map(url => ({ url, type: 'image' as 'image' })));
        
        // Remove duplicates just in case
        const uniqueMedia = Array.from(new Map(media.map(m => [m.url, m])).values());
        
        return uniqueMedia;
    }, [product]);

    const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'video' | 'image'} | null>(null);

    useEffect(() => {
        if (allMedia.length > 0 && !selectedMedia) {
            setSelectedMedia(allMedia[0]);
        }
    }, [allMedia, selectedMedia]);

    const handleAddToCart = async () => {
        if (!user) {
          router.push('/signup');
          return;
        }
        if (!product) return;

        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);

        const cartItemData = {
          productId: product.id,
          sellerId: product.sellerId,
          buyerId: user.uid,
          quantity: increment(1),
          price: product.price,
          name: product.name,
          imageUrl: product.imageUrl || product.imageUrls?.[0] || 'https://picsum.photos/seed/placeholder/200',
          addedAt: serverTimestamp(),
        };

        try {
          await setDoc(cartItemRef, cartItemData, { merge: true });
          toast({ title: 'Added to Cart', description: `${product.name} has been added to your cart.` });
        } catch (error) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: cartItemRef.path, operation: 'write', requestResourceData: cartItemData }));
        }
    };

    const handleBuyNow = async () => {
        if (!user) {
          router.push('/signup');
          return;
        }
        if (!product) return;

        const newOrderRef = doc(collection(firestore, 'orders'));
        const shippingCost = product.shippingCost || 0;
        
        // Check for a reseller ref in localStorage
        const resellerId = localStorage.getItem('resellerRefId');
        
        const newOrderData: Partial<Order> = {
            id: newOrderRef.id,
            buyerId: user.uid,
            sellerId: product.sellerId,
            productId: product.id,
            productName: product.name,
            productImage: product.imageUrl || product.imageUrls?.[0] || 'https://picsum.photos/seed/placeholder/200',
            productPrice: product.price,
            shippingCost: shippingCost,
            totalAmount: product.price + shippingCost,
            orderDate: serverTimestamp() as any,
            shippingAddress: '123 Placeholder Lane, Nairobi', // Placeholder
            orderStatus: 'pending',
            paymentMethod: 'pending',
            quantity: 1,
        };

        // If a reseller ID exists, add it to the order
        if (resellerId) {
            newOrderData.resellerId = resellerId;
        }

        try {
          await setDoc(newOrderRef, newOrderData);
          
          toast({ title: 'Order Created!', description: 'Redirecting you to checkout...' });
          router.push(`/checkout/${newOrderRef.id}`);

        } catch (error) {
           errorEmitter.emit('permission-error', new FirestorePermissionError({ path: newOrderRef.path, operation: 'create', requestResourceData: newOrderData }));
        }
    };
    
    const handleFollow = async () => {
        if (!user) {
            router.push('/signup');
            return;
        }

        const newFollowingState = !isFollowing;
        setIsFollowing(newFollowingState); // Optimistic UI update

        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/follow', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sellerId: sellerId,
                    action: newFollowingState ? 'follow' : 'unfollow',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update follow status.');
            }

            toast({
                title: newFollowingState ? 'Followed!' : 'Unfollowed',
                description: `You are now ${newFollowingState ? 'following' : 'no longer following'} this shop.`,
            });

        } catch (error) {
            console.error('Error updating follow status:', error);
            // Revert optimistic UI update on error
            setIsFollowing(!newFollowingState);
            toast({ variant: 'destructive', title: 'Something went wrong' });
        }
    };
    
    const handleMessageSeller = async () => {
        if (!user) {
            router.push('/signup');
            return;
        }
        if (sellerId === user.uid) {
            toast({ title: 'Cannot start chat', description: 'You cannot message yourself.' });
            return;
        }

        const chatsRef = collection(firestore, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
        
        try {
            const querySnapshot = await getDocs(q);
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => {
                if (doc.data().participantIds.includes(sellerId)) {
                    existingChatId = doc.id;
                }
            });

            if (existingChatId) {
                router.push(`/messages?chatWith=${sellerId}`);
            } else {
                const newChatRef = doc(collection(firestore, 'chats'));
                await setDoc(newChatRef, {
                    id: newChatRef.id,
                    participantIds: [user.uid, sellerId],
                    lastMessage: 'Conversation started.',
                    lastMessageTimestamp: serverTimestamp(),
                });
                router.push(`/messages?chatWith=${sellerId}`);
            }
        } catch (error) {
            console.error("Error handling message seller: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start chat.' });
        }
    };
    
    const handleShare = () => {
        const productUrl = `https://goearnvid.shop/products/${productId}`;
        navigator.clipboard.writeText(productUrl).then(() => {
            toast({
                title: "Link Copied!",
                description: "Product link copied to your clipboard.",
            });
        }).catch(err => {
            console.error('Failed to copy: ', err);
            toast({
                variant: "destructive",
                title: "Failed to Copy",
                description: "Could not copy the link.",
            });
        });
    };
    
    const handleLike = () => {
        if (!firestore || !productId) return;
        const productRef = doc(firestore, 'products', productId);
        
        const batch = writeBatch(firestore);
        batch.update(productRef, { likes: increment(1) });
        batch.commit().catch(console.error);

        toast({
            title: "Liked!",
            description: "You liked this product.",
        });
    };

    const isLoading = isProductLoading || isSellerShopLoading || isSellerProfileLoading;

    if (isLoading) {
        return <MainLayout><ProductPageSkeleton /></MainLayout>;
    }

    if (!product) {
        return (
            <MainLayout>
                <div className="flex h-96 items-center justify-center">
                    <h2 className="text-2xl font-bold">Product not found</h2>
                </div>
            </MainLayout>
        );
    }
    
    const discountPercentage = product.wasPrice ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100) : 0;
    const sellerName = sellerShop?.shopName || sellerProfile?.fullName || 'Anonymous Seller';
    const sellerLogo = sellerShop?.logoUrl || sellerProfile?.profilePictureUrl || 'https://picsum.photos/seed/shoplogo/200';
    const sellerFollowers = sellerShop?.followers || 0;
    const isReseller = userProfile?.userRole === 'reseller';

    const filteredRecommendedProducts = recommendedProducts?.filter(p => p.id !== product.id) || [];

    return (
        <MainLayout>
            <div className="bg-black text-white pb-24">
                {/* 1. Product Media Section */}
                <div className="relative w-full">
                    <div className="aspect-square md:aspect-[16/10] w-full bg-black">
                        {selectedMedia?.type === 'video' ? (
                            <video src={selectedMedia.url} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                        ) : (
                            <Image src={selectedMedia?.url || 'https://picsum.photos/seed/placeholder/1000/1000'} alt={product.name || "Product image"} fill sizes="100vw" className="object-contain" priority />
                        )}
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2">
                        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70" onClick={handleLike}><Heart className="h-5 w-5" /></Button>
                        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70" onClick={handleShare}><Share2 className="h-5 w-5" /></Button>
                    </div>
                    {discountPercentage > 0 && <Badge className="absolute top-4 left-4 bg-red-500 text-white font-bold">{discountPercentage}% OFF</Badge>}
                </div>
                {allMedia.length > 1 && (
                    <div className="bg-neutral-900 py-2">
                        <Carousel opts={{ align: "start" }} className="w-full container px-0">
                            <CarouselContent className="-ml-1">
                                {allMedia.map((media, i) => (
                                    <CarouselItem key={i} className="basis-1/4 sm:basis-1/5 pl-1">
                                        <Card onClick={() => setSelectedMedia(media)} className={cn("overflow-hidden cursor-pointer bg-neutral-800", selectedMedia?.url === media.url && "ring-2 ring-red-500")}>
                                            <CardContent className="p-0 aspect-square relative">
                                                <Image src={media.url} alt={`thumbnail ${i}`} fill sizes="(max-width: 640px) 25vw, 20vw" className="object-cover" />
                                                {media.type === 'video' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Video className="h-6 w-6 text-white" /></div>}
                                            </CardContent>
                                        </Card>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                        </Carousel>
                    </div>
                )}

                <div className="container mx-auto max-w-4xl py-6 px-4 space-y-6">
                    {/* 2. Product Title + Rating + Sold Count */}
                    <div>
                        <p className="text-sm text-red-500 font-semibold hover:underline cursor-pointer">{product.category}</p>
                        <h1 className="font-headline text-2xl md:text-3xl font-bold">{product.name}</h1>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                            <StarRating rating={product.rating || 0} count={reviews?.length || 0} />
                            {reviews && reviews.length > 0 && <span className="text-neutral-400">Sold {product.salesCount || 0}</span>}
                        </div>
                    </div>

                    {/* 3. Price Section */}
                     <div>
                        <p className="text-3xl font-bold text-red-500">USD ${product.price.toLocaleString()}</p>
                    </div>
                    
                    {product.coupon && (
                        <div className="bg-yellow-500/10 border border-dashed border-yellow-500/50 text-yellow-300 p-3 rounded-lg flex items-center gap-3">
                            <Tag className="h-5 w-5 text-yellow-400" />
                            <div>
                                <p className="font-bold">Live Deal</p>
                                <p className="text-sm">Use code <span className="font-mono bg-black/30 px-1.5 py-0.5 rounded-sm">{product.coupon.code}</span> for {product.coupon.discount}% off!</p>
                            </div>
                        </div>
                    )}


                    {/* 4. Delivery & Location Section */}
                    <Card className="bg-[#2a2a2a] border-neutral-800">
                        <CardContent className="p-4 space-y-3 text-sm">
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-neutral-400" /> <span>Ships to <strong>Nairobi, Kenya</strong></span> <Button variant="link" className="p-0 h-auto text-red-500">Change</Button></div>
                            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-neutral-400" /> <span>Standard Delivery (1-2 days) - <strong className="text-white">USD ${product.shippingCost?.toLocaleString() || '0'}</strong></span></div>
                            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-neutral-400" /> <span>7-day return policy</span></div>
                        </CardContent>
                    </Card>

                    {/* 5. Variants & Quantity */}
                    <div className="flex items-center justify-between">
                        <p className="font-semibold">Quantity</p>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-neutral-800 border-neutral-700">-</Button>
                            <span className="w-10 text-center font-bold">1</span>
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-neutral-800 border-neutral-700">+</Button>
                        </div>
                    </div>
                    {product.stock != null && product.stock <= 5 && <p className="text-red-500 text-sm font-semibold">Only {product.stock} left in stock!</p>}


                    {/* 6. Seller Shop Info Block */}
                    {!isReseller && (
                        <Card className="bg-[#2a2a2a] border-neutral-800">
                            <CardContent className="p-4 flex items-center gap-4">
                                <Avatar className="h-12 w-12 border"><AvatarImage src={sellerLogo} /><AvatarFallback>{sellerName?.charAt(0)}</AvatarFallback></Avatar>
                                <div className="flex-1">
                                    <p className="font-bold">{sellerName}</p>
                                    <p className="text-xs text-neutral-400">{sellerFollowers.toLocaleString()} followers</p>
                                </div>
                                <Button variant={isFollowing ? 'secondary' : 'default'} size="sm" className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600" onClick={handleFollow}>{isFollowing ? 'Following' : 'Follow'}</Button>
                                <Button variant="outline" size="sm" className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600" asChild>
                                    <Link href={`/sellers/${sellerId}`}>Visit Shop</Link>
                                </Button>
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
                                {areReviewsLoading ? (
                                    <p>Loading reviews...</p>
                                ) : reviews && reviews.length > 0 ? (
                                    reviews.map(review => <ReviewCard key={review.id} review={review} />)
                                ) : (
                                    <p className="text-neutral-400 text-center py-4">No reviews yet.</p>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                        {/* 9. Q&A */}
                         <AccordionItem value="qa">
                            <AccordionTrigger>Questions & Answers</AccordionTrigger>
                            <AccordionContent>
                                <p className="text-neutral-400 text-sm text-center py-4">No questions yet.</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    
                    {/* 10. Recommended From This Seller */}
                    <div>
                        <h2 className="font-headline text-xl font-bold mt-8 mb-4">You Might Also Like</h2>
                         {areRecsLoading ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Skeleton className="h-64 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                         ) : filteredRecommendedProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {filteredRecommendedProducts.map(p => <ProductCard key={p.id} product={p} />)}
                            </div>
                         ) : (
                             <p className="text-neutral-400 text-sm">No recommendations available.</p>
                         )}
                    </div>
                </div>
            </div>

            {/* 12. Bottom Sticky Action Bar */}
            {!isReseller && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-t border-neutral-800 p-2 flex items-center gap-2">
                    <Link href={`/sellers/${sellerId}`} className="flex flex-col items-center p-2">
                        <Store className="h-5 w-5 text-neutral-300"/>
                        <span className="text-xs text-neutral-400">Shop</span>
                    </Link>
                    <Button variant="ghost" onClick={handleMessageSeller} className="flex flex-col items-center p-2 h-auto">
                        <MessageSquare className="h-5 w-5 text-neutral-300" />
                        <span className="text-xs text-neutral-400">Chat</span>
                    </Button>
                    <Button variant="secondary" className="flex-1 bg-[#2a2a2a] text-white" onClick={handleAddToCart}>Add to Cart</Button>
                    <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleBuyNow}>Buy Now</Button>
                </div>
            )}
        </MainLayout>
    );
}

    
