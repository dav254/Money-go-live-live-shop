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
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Star, ShieldCheck, Truck, MapPin, MessageSquare, Plus, Share2, Store, Heart, Zap, Video, ShoppingCart, Tag, Minus, Globe, Sparkles, Clock, Package, Loader2, Info } from 'lucide-react';
import { ProductCard } from '@/components/products/product-card';
import { cn } from '@/lib/utils';
import type { Product, SellerShop, UserProfile, Review, Order } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase, useUser, errorEmitter, useUserProfile, useCollection } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp, collection, updateDoc, arrayUnion, arrayRemove, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { formatDistanceToNow } from 'date-fns';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { getPlaceholderImage } from '@/lib/placeholder-images';

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

const ReviewCard = ({ review }: { review: Review }) => {
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => doc(firestore, 'userProfiles', review.buyerId), [firestore, review.buyerId]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    return (
        <div className="flex gap-4 border-b border-neutral-800 py-4 last:border-b-0">
             <Avatar className="h-8 w-8 border">
                <AvatarImage src={userProfile?.profilePictureUrl} />
                <AvatarFallback>{userProfile?.fullName?.charAt(0) || 'A'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{userProfile?.fullName || 'Anonymous'}</p>
                    <p className="text-xs text-neutral-400">{review.createdAt?.toDate ? formatDistanceToNow(review.createdAt.toDate(), { addSuffix: true }) : 'Just now'}</p>
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
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (firestore && productId && user) {
            const productRef = doc(firestore, 'products', productId);
            updateDoc(productRef, { viewCount: increment(1) }).catch(console.error);
        }
    }, [firestore, productId, user]);

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
        return query(collection(firestore, 'products'), where('sellerId', '==', product.sellerId), limit(5));
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
        if (product.videoUrl) media.push({ url: product.videoUrl, type: 'video' as const });
        if (product.videoUrls) media.push(...product.videoUrls.map(url => ({ url, type: 'video' as const })));
        if (product.imageUrl) media.push({ url: product.imageUrl, type: 'image' as const });
        if (product.imageUrls) media.push(...product.imageUrls.map(url => ({ url, type: 'image' as const })));
        return Array.from(new Map(media.map(m => [m.url, m])).values());
    }, [product]);

    const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'video' | 'image'} | null>(null);

    useEffect(() => {
        if (allMedia.length > 0 && !selectedMedia) {
            setSelectedMedia(allMedia[0]);
        }
    }, [allMedia, selectedMedia]);

    const handleAddToCart = async () => {
        if (!user) { router.push('/login'); return; }
        if (!product) return;
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
        const cartItemData = {
          productId: product.id,
          sellerId: product.sellerId,
          buyerId: user.uid,
          quantity: increment(quantity),
          price: product.price,
          name: product.name,
          imageUrl: product.imageUrl || product.imageUrls?.[0] || getPlaceholderImage(),
          addedAt: serverTimestamp(),
        };
        try {
          await setDoc(cartItemRef, cartItemData, { merge: true });
          toast({ title: 'Added to Cart', description: `${quantity} x ${product.name} has been added to your cart.` });
        } catch (error) {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: cartItemRef.path, operation: 'write', requestResourceData: cartItemData }));
        }
    };

    const handleBuyNow = async () => {
        if (!user || !userProfile) { router.push('/login'); return; }
        if (!product) return;
        const newOrderRef = doc(collection(firestore, 'orders'));
        const shippingCost = product.shippingCost || 0;
        const subtotal = product.price * quantity;
        let resellerId = localStorage.getItem('resellerRefId') || userProfile.referredBy;
        const newOrderData: Partial<Order> = {
            id: newOrderRef.id,
            buyerId: user.uid,
            sellerId: product.sellerId,
            items: [{
                productId: product.id,
                name: product.name || '',
                price: product.price,
                quantity: quantity,
                imageUrl: product.imageUrl || product.imageUrls?.[0] || getPlaceholderImage()
            }],
            subtotal: subtotal,
            productPrice: subtotal,
            shippingCost: shippingCost,
            totalAmount: subtotal + shippingCost,
            orderDate: serverTimestamp() as any,
            shippingAddress: '123 Placeholder Lane, Nairobi',
            orderStatus: 'pending',
            paymentMethod: 'pending',
            ...(resellerId && { resellerId }),
        };
        try {
          await setDoc(newOrderRef, newOrderData);
          if (resellerId) localStorage.removeItem('resellerRefId');
          toast({ title: 'Order Created!', description: 'Redirecting you to checkout...' });
          router.push(`/checkout/${newOrderRef.id}`);
        } catch (error) {
           errorEmitter.emit('permission-error', new FirestorePermissionError({ path: newOrderRef.path, operation: 'create', requestResourceData: newOrderData }));
        }
    };
    
    const handleFollow = async () => {
        if (!user) { router.push('/login'); return; }
        const newFollowingState = !isFollowing;
        setIsFollowing(newFollowingState);
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/follow', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ sellerId: sellerId, action: newFollowingState ? 'follow' : 'unfollow' }),
            });
            if (!response.ok) throw new Error('Failed');
            toast({ title: newFollowingState ? 'Followed!' : 'Unfollowed' });
        } catch (error) {
            setIsFollowing(!newFollowingState);
            toast({ variant: 'destructive', title: 'Something went wrong' });
        }
    };
    
    const handleMessageSeller = async () => {
        if (!user || !firestore) { toast({ title: 'Please log in' }); router.push('/login'); return; }
        if (sellerId === user.uid) { toast({ title: 'Cannot message yourself' }); return; }
        const chatsRef = collection(firestore, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));
        try {
            const querySnapshot = await getDocs(q);
            let existingChatId: string | null = null;
            querySnapshot.forEach(doc => { if (doc.data().participantIds.includes(sellerId)) existingChatId = doc.id; });
            if (existingChatId) { router.push(`/messages?chatWith=${sellerId}`); }
            else {
                const newChatRef = doc(collection(firestore, 'chats'));
                await setDoc(newChatRef, { id: newChatRef.id, participantIds: [user.uid, sellerId], lastMessage: 'Conversation started.', lastMessageTimestamp: serverTimestamp() });
                router.push(`/messages?chatWith=${sellerId}`);
            }
        } catch (error) { toast({ variant: 'destructive', title: 'Error' }); }
    };
    
    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            toast({ title: "Link Copied!" });
        });
    };

    const isLoading = isProductLoading || isSellerShopLoading || isSellerProfileLoading;
    const filteredRecommendedProducts = useMemo(() => recommendedProducts?.filter(p => p.id !== productId) || [], [recommendedProducts, productId]);

    if (isLoading) return <MainLayout><div className="p-8">Loading...</div></MainLayout>;
    if (!product) return <MainLayout><div className="flex h-96 items-center justify-center text-white font-bold">Product not found</div></MainLayout>;
    
    const discountPercentage = product.wasPrice && product.price ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100) : 0;
    const sellerName = sellerShop?.shopName || sellerProfile?.fullName || 'Anonymous Seller';
    const sellerLogo = sellerShop?.logoUrl || sellerProfile?.profilePictureUrl || getPlaceholderImage();
    const LayoutComponent = userProfile?.userRole === 'reseller' ? ResellerLayout : MainLayout;

    return (
        <LayoutComponent>
            <div className="bg-black text-white pb-24">
                <div className="relative w-full">
                    <div className="aspect-square md:aspect-[16/10] w-full bg-black">
                        {selectedMedia?.type === 'video' ? (
                            <video src={selectedMedia.url} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                        ) : (
                            <Image src={selectedMedia?.url || getPlaceholderImage()} alt={product.name} fill sizes="100vw" className="object-contain" priority />
                        )}
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2">
                        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 h-10 w-10 hover:bg-black/70 border-none" onClick={handleShare}><Share2 className="h-5 w-5" /></Button>
                    </div>
                    {discountPercentage > 0 && <Badge className="absolute top-4 left-4 bg-red-500 text-white font-black uppercase tracking-widest text-[10px] h-7 px-3">{discountPercentage}% OFF</Badge>}
                </div>
                
                {allMedia.length > 1 && (
                    <div className="bg-neutral-900/50 py-3">
                        <Carousel opts={{ align: "start" }} className="w-full container px-4">
                            <CarouselContent className="-ml-2">
                                {allMedia.map((media, i) => (
                                    <CarouselItem key={i} className="basis-1/4 sm:basis-1/5 pl-2">
                                        <Card onClick={() => setSelectedMedia(media)} className={cn("overflow-hidden cursor-pointer bg-neutral-800 border-none transition-all", selectedMedia?.url === media.url && "ring-2 ring-primary scale-95")}>
                                            <CardContent className="p-0 aspect-square relative">
                                                <Image src={media.url} alt={`thumb ${i}`} fill sizes="(max-width: 640px) 25vw, 20vw" className="object-cover" />
                                                {media.type === 'video' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Video className="h-6 w-6 text-white" /></div>}
                                            </CardContent>
                                        </Card>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                        </Carousel>
                    </div>
                )}

                <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-black uppercase text-[10px] tracking-widest h-6 px-2">{product.category}</Badge>
                                {product.brand && <Badge variant="outline" className="border-white/20 text-neutral-400 font-bold uppercase text-[10px] tracking-widest h-6 px-2">{product.brand}</Badge>}
                            </div>
                            <h1 className="font-headline text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">{product.name}</h1>
                            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-neutral-500">
                                <StarRating rating={product.rating || 0} count={reviews?.length || 0} />
                                <span>{product.salesCount || 0} Sold</span>
                            </div>
                        </div>
                    </div>

                     <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-3">
                            <p className="text-4xl font-black text-primary tracking-tighter">USD ${product.price.toLocaleString()}</p>
                            {product.wasPrice && <p className="text-xl text-neutral-500 line-through font-bold">${product.wasPrice.toLocaleString()}</p>}
                        </div>
                    </div>

                    <Card className="bg-neutral-900 border-white/5 rounded-3xl">
                        <CardContent className="p-6 space-y-4 text-sm font-medium">
                            <div className="flex items-center gap-3 text-neutral-300"><MapPin className="h-5 w-5 text-primary" /> <span>Pickup / Ship from: <strong className="text-white uppercase tracking-tight">{sellerShop?.location || 'Store Location'}</strong></span></div>
                            <div className="flex items-center gap-3 text-neutral-300"><Truck className="h-5 w-5 text-primary" /> <span>Delivery: <strong className="text-white">{product.deliveryOptions || 'Standard Shipping'}</strong> — <strong className="text-green-400">USD ${product.shippingCost?.toLocaleString() || '0.00'}</strong></span></div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between bg-neutral-900/50 p-4 rounded-3xl border border-white/5">
                        <p className="font-black uppercase tracking-widest text-xs text-neutral-500">Select Quantity</p>
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 border-white/5" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                            <span className="w-8 text-center font-black text-xl">{quantity}</span>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 border-white/5" onClick={() => setQuantity(q => Math.min(product.stock || 99, q + 1))}><Plus className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    <Card className="bg-neutral-900 border-white/5 rounded-3xl overflow-hidden">
                        <CardContent className="p-6 flex items-center gap-4">
                            <Avatar className="h-14 w-14 border-2 border-primary/20"><AvatarImage src={sellerLogo} /><AvatarFallback className="bg-neutral-800 text-lg font-black uppercase">{sellerName?.charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-lg uppercase tracking-tighter truncate leading-none mb-1">{sellerName}</p>
                                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-neutral-500"><span className="text-primary">{sellerShop?.followers?.toLocaleString() || 0} followers</span></div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant={isFollowing ? 'secondary' : 'default'} size="sm" className="rounded-xl h-10 font-bold px-4" onClick={handleFollow}>{isFollowing ? 'Following' : 'Follow'}</Button>
                                <Button variant="outline" size="sm" className="rounded-xl h-10 border-white/10 hover:bg-white/5 font-bold px-4" asChild><Link href={`/sellers/${sellerId}`}>Store</Link></Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="description">
                        <AccordionItem value="description" className="border-white/10 bg-neutral-900/30 rounded-3xl px-6 border">
                            <AccordionTrigger className="font-black uppercase tracking-widest text-xs hover:no-underline py-6">The Full Story</AccordionTrigger>
                            <AccordionContent className="pb-8 space-y-6">
                                <div className="prose prose-sm dark:prose-invert text-neutral-300 whitespace-pre-wrap">{product.description}</div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        {(sellerShop?.returnPolicy || sellerShop?.deliveryPolicy) && (
                            <AccordionItem value="policies" className="border-white/10 bg-neutral-900/30 rounded-3xl px-6 border">
                                <AccordionTrigger className="font-black uppercase tracking-widest text-xs hover:no-underline py-6">Shipping & Returns</AccordionTrigger>
                                <AccordionContent className="pb-8 space-y-6">
                                    {sellerShop?.deliveryPolicy && (
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2"><Truck className="h-3 w-3" /> Delivery Policy</h4>
                                            <p className="text-sm text-neutral-400">{sellerShop.deliveryPolicy}</p>
                                        </div>
                                    )}
                                    {sellerShop?.returnPolicy && (
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2"><Package className="h-3 w-3" /> Return Policy</h4>
                                            <p className="text-sm text-neutral-400">{sellerShop.returnPolicy}</p>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        )}
                    </Accordion>
                    
                    <div className="pt-8">
                        <h2 className="font-headline text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3"><Plus className="text-primary" />More from this Shop</h2>
                         {areRecsLoading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">Loading...</div> : filteredRecommendedProducts.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{filteredRecommendedProducts.map(p => <ProductCard key={p.id} product={p} />)}</div> : <p className="text-neutral-600 font-bold uppercase text-[10px] tracking-widest text-center py-12 border-2 border-dashed rounded-3xl border-white/5">No other products.</p>}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 p-3 flex items-center gap-3">
                    <Link href={`/sellers/${sellerId}`} className="flex flex-col items-center px-3 py-1 group"><Store className="h-5 w-5 text-neutral-400 group-hover:text-primary transition-colors"/><span className="text-[9px] font-black uppercase tracking-widest mt-1 text-neutral-500">Shop</span></Link>
                    {userProfile?.userRole !== 'reseller' && (
                        <Button variant="ghost" onClick={handleMessageSeller} className="flex flex-col items-center px-3 py-1 h-auto group bg-transparent hover:bg-transparent"><MessageSquare className="h-5 w-5 text-neutral-400 group-hover:text-primary transition-colors" /><span className="text-[9px] font-black uppercase tracking-widest mt-1 text-neutral-500">Chat</span></Button>
                    )}
                    <Button variant="secondary" className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-2xl h-14 font-black uppercase tracking-widest text-xs" onClick={handleAddToCart}>Add to Cart</Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20" onClick={handleBuyNow}>Buy It Now</Button>
                </div>
            </div>
        </LayoutComponent>
    );
}
