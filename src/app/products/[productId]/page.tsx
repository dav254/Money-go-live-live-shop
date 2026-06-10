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
import { MapPin, Plus, Store, Minus, X, Maximize2, Loader2, ShoppingCart, Truck, Tag, Facebook, Instagram, Twitter, MessageCircle, Mail, Phone, Clock, ShieldCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product, SellerShop, UserProfile, Order } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase, useUser, useUserProfile, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, increment, serverTimestamp, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogHeader } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProductInfo } from '@/components/live/product-info';

export default function BuyerProductPage() {
    const params = useParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { user, isLoading: isUserLoading } = useUser();
    const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
    const { toast } = useToast();
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

    const [selectedMedia, setSelectedMedia] = useState<{url: string, type: 'video' | 'image'} | null>(null);

    // Reset local state when product ID changes
    useEffect(() => {
        setQuantity(1);
        setSelectedMedia(null);
    }, [productId]);

    const allMedia = useMemo(() => {
        if (!product) return [];
        const media: { url: string, type: 'video' | 'image' }[] = [];
        
        if (product.videoUrl && product.videoUrl.trim() !== "") media.push({ url: product.videoUrl, type: 'video' });
        if (Array.isArray(product.videoUrls)) {
            product.videoUrls.forEach(url => {
                if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
                    media.push({ url, type: 'video' });
                }
            });
        }

        if (product.imageUrl && product.imageUrl.trim() !== "") media.push({ url: product.imageUrl, type: 'image' });
        if (Array.isArray(product.imageUrls)) {
            product.imageUrls.forEach(url => {
                if (url && url.trim() !== "" && !media.some(m => m.url === url)) {
                    media.push({ url, type: 'image' });
                }
            });
        }
        
        return media.length > 0 ? media : [{ url: getPlaceholderImage(), type: 'image' }];
    }, [product]);

    useEffect(() => {
        if (allMedia.length > 0 && !selectedMedia) {
            setSelectedMedia(allMedia[0]);
        }
    }, [allMedia, selectedMedia]);

    const handleAddToCart = () => {
        if (!user) { router.push('/login'); return; }
        if (!product || !firestore) return;
        
        const cartItemRef = doc(firestore, 'userProfiles', user.uid, 'cart', product.id);
        const cartData = {
            productId: product.id || '',
            sellerId: product.sellerId || '',
            buyerId: user.uid,
            quantity: increment(quantity),
            price: product.price || 0,
            name: product.name || 'Unnamed Product',
            imageUrl: product.imageUrl || getPlaceholderImage(),
            addedAt: serverTimestamp(),
        };

        setDoc(cartItemRef, cartData, { merge: true })
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: cartItemRef.path,
                    operation: 'write',
                    requestResourceData: cartData,
                }));
            });

        toast({ title: 'Added to Cart' });
    };

    const handleBuyNow = () => {
        if (!user) { router.push('/login'); return; }
        if (!product || !firestore) return;

        const ordersCollectionRef = collection(firestore, 'orders');
        const newOrderRef = doc(ordersCollectionRef);
        const shippingCost = product.shippingCost || 0;
        const subtotal = (product.price || 0) * quantity;
        
        const newOrderData = {
            id: newOrderRef.id,
            buyerId: user.uid,
            sellerId: product.sellerId || '',
            items: [{ 
                productId: product.id || '', 
                name: product.name || 'Unnamed Product', 
                price: product.price || 0, 
                quantity, 
                imageUrl: product.imageUrl || getPlaceholderImage() 
            }],
            productName: product.name || 'Unnamed Product',
            productImage: product.imageUrl || getPlaceholderImage(),
            productPrice: product.price || 0,
            shippingCost: shippingCost,
            totalAmount: subtotal + shippingCost,
            subtotal: subtotal,
            orderDate: serverTimestamp(),
            orderStatus: 'pending',
            paymentMethod: 'pending',
            quantity: quantity,
            shippingAddress: userProfile?.location || 'Awaiting Input',
        };

        setDoc(newOrderRef, newOrderData)
            .then(() => {
                toast({ title: 'Order Created!', description: 'Redirecting to checkout...' });
                router.push(`/checkout/${newOrderRef.id}`);
            })
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: newOrderRef.path,
                    operation: 'create',
                    requestResourceData: newOrderData,
                }));
            });
    };

    const isLoading = !isMounted || isProductLoading || isSellerShopLoading || isSellerProfileLoading || isUserLoading || isProfileLoading;
    if (isLoading) return <MainLayout><div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></MainLayout>;
    if (!product) return <MainLayout><div className="flex h-96 items-center justify-center text-white font-bold">Product not found</div></MainLayout>;
    
    return (
        <MainLayout>
            <div className="bg-black text-white pb-32 min-h-screen">
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
                                        <DialogTitle>{product.name} - Immersive View</DialogTitle>
                                        <DialogDescription>A high-fidelity full-screen view of the product image.</DialogDescription>
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
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex-1 min-w-0">
                            <Badge variant="secondary" className="bg-primary/10 text-primary font-black uppercase text-[10px] mb-2">{product.category}</Badge>
                            <h1 className="font-headline text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none">{product.name}</h1>
                            <p className="text-4xl md:text-5xl font-black text-primary tracking-tighter mt-4 leading-none">USD ${product.price?.toLocaleString()}</p>
                        </div>
                        
                        <div className="bg-neutral-900/50 rounded-3xl p-6 border border-white/10 md:w-72 shrink-0 shadow-2xl">
                            <Link href={`/sellers/${sellerId}`} className="flex items-center gap-3 group mb-4">
                                <Avatar className="h-10 w-10 border border-white/10 group-hover:border-primary transition-all">
                                    <AvatarImage src={sellerShop?.logoUrl} />
                                    <AvatarFallback className="bg-neutral-800 text-xs font-black uppercase">{sellerShop?.shopName?.charAt(0) || 'S'}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest leading-none mb-1">Seller</p>
                                    <p className="font-bold text-sm truncate uppercase tracking-tight group-hover:text-primary transition-colors">{sellerShop?.shopName || 'Marketplace Seller'}</p>
                                </div>
                            </Link>
                            
                            <Separator className="bg-white/5 mb-4" />
                            
                            <div className="space-y-4 mb-6">
                                {sellerShop?.contactEmail && (
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-3.5 w-3.5 text-primary" />
                                        <span className="text-[11px] font-medium text-neutral-300 truncate">{sellerShop.contactEmail}</span>
                                    </div>
                                )}
                                {sellerShop?.contactPhone && (
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-3.5 w-3.5 text-primary" />
                                        <span className="text-[11px] font-medium text-neutral-300">{sellerShop.contactPhone}</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-3">Connect With Shop</p>
                            <div className="flex items-center gap-2 mb-4">
                                {sellerShop?.facebookUrl && <a href={sellerShop.facebookUrl} target="_blank" rel="noopener noreferrer" className="h-9 w-9 bg-white/5 hover:bg-blue-600 rounded-xl flex items-center justify-center text-white transition-all"><Facebook className="h-4 w-4" /></a>}
                                {sellerShop?.instagramUrl && <a href={sellerShop.instagramUrl} target="_blank" rel="noopener noreferrer" className="h-9 w-9 bg-white/5 hover:bg-pink-600 rounded-xl flex items-center justify-center text-white transition-all"><Instagram className="h-4 w-4" /></a>}
                                {sellerShop?.twitterUrl && <a href={sellerShop.twitterUrl} target="_blank" rel="noopener noreferrer" className="h-9 w-9 bg-white/5 hover:bg-sky-500 rounded-xl flex items-center justify-center text-white transition-all"><Twitter className="h-4 w-4" /></a>}
                            </div>

                            {sellerShop?.contactWhatsapp && (
                                <Button asChild variant="outline" className="w-full h-11 rounded-xl border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-600 hover:text-white font-black uppercase tracking-widest text-[9px] transition-all">
                                    <a href={`https://wa.me/${sellerShop.contactWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                        <MessageCircle className="h-3.5 w-3.5 mr-2" /> CHAT ON WHATSAPP
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card className="bg-neutral-900 border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                                <div className="p-6 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                        <MapPin className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-0.5">Pickup Location</p>
                                        <p className="font-bold text-sm text-white uppercase tracking-tight">{sellerShop?.location || 'Global Store'}</p>
                                    </div>
                                </div>
                                <div className="p-6 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                        <Truck className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest mb-0.5">Shipping Method</p>
                                        <p className="font-bold text-sm text-white uppercase tracking-tight">
                                            {product.deliveryOptions || 'Verified Delivery'} — <span className="text-green-400">${product.shippingCost?.toFixed(2) || '0.00'}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="w-full sm:w-auto flex items-center justify-between bg-neutral-900/50 p-3 rounded-2xl border border-white/5 min-w-[160px]">
                            <p className="font-black uppercase tracking-widest text-[9px] text-neutral-500 ml-2">Qty</p>
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-3.5 w-3.5" /></Button>
                                <span className="w-8 text-center font-black text-xl tabular-nums">{quantity}</span>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10" onClick={() => setQuantity(q => q + 1)}><Plus className="h-3.5 w-3.5" /></Button>
                            </div>
                        </div>
                        
                        <div className="flex-1 w-full grid grid-cols-2 gap-3">
                            <Button variant="secondary" className="bg-white/5 hover:bg-white/10 text-white border-white/10 rounded-2xl h-16 font-black uppercase text-xs tracking-widest" onClick={handleAddToCart}>
                                <ShoppingCart className="mr-2 h-4 w-4" /> ADD TO CART
                            </Button>
                            <Button className="bg-primary hover:bg-primary/90 text-white rounded-2xl h-16 font-black uppercase text-xs tracking-widest shadow-2xl shadow-primary/20" onClick={handleBuyNow}>
                                BUY NOW <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="description">
                        <AccordionItem value="description" className="border-white/10 bg-neutral-900/30 rounded-3xl px-8 border shadow-xl">
                            <AccordionTrigger className="font-black uppercase tracking-[0.2em] text-[11px] py-6 hover:no-underline">PRODUCT SPECIFICATIONS</AccordionTrigger>
                            <AccordionContent className="pb-10 text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                {product.description}
                                
                                {product.tags && (
                                    <div className="flex flex-wrap gap-2 mt-8">
                                        {product.tags.split(',').map(tag => (
                                            <Badge key={tag} variant="outline" className="bg-white/5 border-white/5 text-[9px] font-black uppercase py-1 px-3">
                                                #{tag.trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="policies" className="border-white/10 bg-neutral-900/30 rounded-3xl px-8 border shadow-xl">
                            <AccordionTrigger className="font-black uppercase tracking-[0.2em] text-[11px] py-6 hover:no-underline">SHIPPING & RETURNS</AccordionTrigger>
                            <AccordionContent className="pb-10 text-neutral-300 text-sm leading-relaxed space-y-8 font-medium">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-white">
                                            <Truck className="h-4 w-4 text-primary" />
                                            <h4 className="font-black uppercase text-[10px] tracking-widest">Delivery Policy</h4>
                                        </div>
                                        <p className="bg-white/5 p-4 rounded-2xl border border-white/5 leading-relaxed">
                                            {sellerShop?.deliveryPolicy || 'Standard marketplace shipping terms apply. Shipping estimated at 2-5 business days.'}
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-white">
                                            <ShieldCheck className="h-4 w-4 text-primary" />
                                            <h4 className="font-black uppercase text-[10px] tracking-widest">Return Policy</h4>
                                        </div>
                                        <p className="bg-white/5 p-4 rounded-2xl border border-white/5 leading-relaxed">
                                            {sellerShop?.returnPolicy || 'Eligible for return within 30 days if item is unused and in original packaging.'}
                                        </p>
                                    </div>
                                </div>

                                <Separator className="bg-white/5" />

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-white">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <h4 className="font-black uppercase text-[10px] tracking-widest">Operation Metadata</h4>
                                    </div>
                                    <div className="flex flex-col gap-4">
                                        <p className="text-xs font-bold uppercase tracking-tight text-neutral-400">
                                            Store Hours: <span className="text-white ml-1">{sellerShop?.storeHours || 'Open 24/7'}</span>
                                        </p>
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                                                <Store className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <h5 className="font-black text-white text-[9px] uppercase tracking-widest mb-1">On Platform Since</h5>
                                                <span className="text-sm font-medium">{sellerProfile?.joinDate ? new Date(sellerProfile.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric'}) : 'Founding Member'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>

                <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-2xl border-t border-white/10 p-4 md:hidden">
                    <div className="flex items-center gap-3">
                        <Link href={`/sellers/${sellerId}`} className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-2xl shrink-0 group border border-white/5">
                            <Store className="h-5 w-5 text-neutral-400 group-hover:text-primary transition-colors"/>
                            <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-neutral-500">Shop</span>
                        </Link>
                        <Button className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 font-black uppercase text-xs tracking-widest" onClick={handleBuyNow}>
                            BUY FOR ${ ((product.price || 0) * quantity).toLocaleString() }
                        </Button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
