
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Star, Truck, MapPin, Plus, Store, Minus, X, Maximize2, Loader2, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product, SellerShop, UserProfile, Review } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase, useUser, useUserProfile, useCollection } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp, collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';

export default function BuyerProductPage() {
    const params = useParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const { toast } = useToast();
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);

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
    const { data: reviews } = useCollection<Review>(reviewsQuery);

    const allMedia = useMemo(() => {
        if (!product) return [];
        const media: { url: string, type: 'video' | 'image' }[] = [];
        if (product.videoUrl && product.videoUrl.trim() !== "") media.push({ url: product.videoUrl, type: 'video' });
        if (product.videoUrls) product.videoUrls.forEach(url => url && media.push({ url, type: 'video' }));
        if (product.imageUrl && product.imageUrl.trim() !== "") media.push({ url: product.imageUrl, type: 'image' });
        if (product.imageUrls) product.imageUrls.forEach(url => url && media.push({ url, type: 'image' }));
        return media.length > 0 ? media : [{ url: getPlaceholderImage(), type: 'image' }];
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
        try {
          await setDoc(cartItemRef, {
            productId: product.id,
            sellerId: product.sellerId,
            buyerId: user.uid,
            quantity: increment(quantity),
            price: product.price,
            name: product.name,
            imageUrl: product.imageUrl || getPlaceholderImage(),
            addedAt: serverTimestamp(),
          }, { merge: true });
          toast({ title: 'Added to Cart' });
        } catch (error) { console.error(error); }
    };

    const handleBuyNow = async () => {
        if (!user) { router.push('/login'); return; }
        if (!product) return;
        const newOrderRef = doc(collection(firestore, 'orders'));
        const shippingCost = product.shippingCost || 0;
        const subtotal = product.price * quantity;
        try {
          await setDoc(newOrderRef, {
            id: newOrderRef.id,
            buyerId: user.uid,
            sellerId: product.sellerId,
            items: [{ productId: product.id, name: product.name, price: product.price, quantity, imageUrl: product.imageUrl }],
            totalAmount: subtotal + shippingCost,
            orderDate: serverTimestamp(),
            orderStatus: 'pending',
            paymentMethod: 'pending',
          });
          router.push(`/checkout/${newOrderRef.id}`);
        } catch (error) { console.error(error); }
    };

    const isLoading = isProductLoading || isSellerShopLoading || isSellerProfileLoading || isUserLoading || isProfileLoading;
    if (isLoading) return <MainLayout><div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></MainLayout>;
    if (!product) return <MainLayout><div className="flex h-96 items-center justify-center text-white font-bold">Product not found</div></MainLayout>;
    
    const LayoutComponent = userProfile?.userRole === 'reseller' ? ResellerLayout : MainLayout;

    return (
        <LayoutComponent>
            <div className="bg-black text-white pb-24 min-h-screen">
                <div className="relative w-full">
                    <div className="relative aspect-square md:aspect-[16/10] w-full bg-black group">
                        {selectedMedia?.type === 'image' ? (
                            <Dialog>
                                <DialogTrigger asChild>
                                    <div className="cursor-zoom-in relative w-full h-full">
                                        <Image src={selectedMedia.url} alt={product.name} fill className="object-contain" priority />
                                        <div className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Maximize2 className="h-5 w-5 text-white" />
                                        </div>
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-none w-screen h-screen p-0 border-none bg-black/95 flex items-center justify-center z-[100]">
                                    <DialogHeader className="sr-only">
                                        <DialogTitle>{product.name} - Full Resolution View</DialogTitle>
                                        <DialogDescription>A high-resolution immersive view of the product media.</DialogDescription>
                                    </DialogHeader>
                                    <div className="relative w-full h-full flex items-center justify-center p-4">
                                        <DialogClose className="absolute top-6 right-6 z-[110] bg-white/10 hover:bg-white/20 p-3 rounded-full text-white">
                                            <X className="h-8 w-8" />
                                        </DialogClose>
                                        <div className="relative w-full h-full">
                                            <Image src={selectedMedia.url} alt={product.name} fill className="object-contain" />
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        ) : (
                            <video src={selectedMedia?.url} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                        )}
                    </div>
                </div>
                
                {allMedia.length > 1 && (
                    <div className="bg-neutral-900/50 py-3 border-y border-white/5 overflow-x-auto flex gap-2 px-4 scrollbar-hide">
                        {allMedia.map((media, i) => (
                            <button key={i} onClick={() => setSelectedMedia(media)} className={cn("relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0 border-2 transition-all", selectedMedia?.url === media.url ? "border-primary scale-105" : "border-transparent opacity-60")}>
                                <Image src={media.url} alt={`thumb ${i}`} fill className="object-cover" />
                            </button>
                        ))}
                    </div>
                )}

                <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8">
                    <div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary font-black uppercase text-[10px] mb-2">{product.category}</Badge>
                        <h1 className="font-headline text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">{product.name}</h1>
                        <p className="text-4xl font-black text-primary tracking-tighter mt-4">USD ${product.price.toLocaleString()}</p>
                    </div>

                    <Card className="bg-neutral-900 border-white/5 rounded-3xl">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-3 text-neutral-300"><MapPin className="h-5 w-5 text-primary" /> <span>Pickup: <strong className="text-white">{sellerShop?.location || 'Store Location'}</strong></span></div>
                            <div className="flex items-center gap-3 text-neutral-300"><Truck className="h-5 w-5 text-primary" /> <span>Shipping: <strong className="text-white">{product.deliveryOptions || 'Standard'}</strong> — <strong className="text-green-400">${product.shippingCost || '0.00'}</strong></span></div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between bg-neutral-900/50 p-4 rounded-3xl border border-white/5">
                        <p className="font-black uppercase tracking-widest text-xs text-neutral-500">Quantity</p>
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                            <span className="w-8 text-center font-black text-xl">{quantity}</span>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="description">
                        <AccordionItem value="description" className="border-white/10 bg-neutral-900/30 rounded-3xl px-6 border">
                            <AccordionTrigger className="font-black uppercase tracking-widest text-xs py-6">The Full Story</AccordionTrigger>
                            <AccordionContent className="pb-8 text-neutral-300 whitespace-pre-wrap">{product.description}</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/5 p-3 flex items-center gap-3">
                    <Link href={`/sellers/${sellerId}`} className="flex flex-col items-center px-3 py-1 group"><Store className="h-5 w-5 text-neutral-400 group-hover:text-primary transition-colors"/><span className="text-[9px] font-black uppercase tracking-widest mt-1 text-neutral-500">Shop</span></Link>
                    <Button variant="secondary" className="flex-1 bg-white/5 text-white rounded-2xl h-14 font-black uppercase text-xs" onClick={handleAddToCart}>Add to Cart</Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 font-black uppercase text-xs" onClick={handleBuyNow}>Buy Now</Button>
                </div>
            </div>
        </LayoutComponent>
    );
}
