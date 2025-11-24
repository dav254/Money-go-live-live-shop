
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { useParams } from 'next/navigation';
import type { Product, SellerShop, UserProfile, Review } from '@/lib/types';
import { doc, collection, query, where, collectionGroup } from 'firebase/firestore';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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

const StarRating = ({ rating, count }: { rating: number, count?: number }) => (
    <div className="flex items-center gap-1">
        <div className="flex items-center text-yellow-400">
            {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.round(rating) ? 'fill-current' : ''}`} />
            ))}
        </div>
        {count !== undefined && <span className="text-xs text-muted-foreground">({count})</span>}
    </div>
);


export default function BuyerProductDetailPage() {
    const params = useParams();
    const productId = params.productId as string;
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();

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


    // State
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const allImages = useMemo(() => {
        if (!product) return [];
        return [product.imageUrl, ...(product.imageUrls || [])].filter(Boolean) as string[];
    }, [product]);
    
    useEffect(() => {
        if (allImages.length > 0 && !selectedImage) {
            setSelectedImage(allImages[0]);
        }
    }, [allImages, selectedImage]);

    const isLoading = isProductLoading || isSellerLoading || areReviewsLoading;
    
    if (isLoading) {
        return <ProductPageSkeleton />;
    }

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
    
    const discountPercentage = product.wasPrice && product.price
        ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100)
        : 0;

  return (
    <MainLayout>
      <div className="bg-background pb-24">
        {/* 1. Product Media Section */}
        <div className="relative w-full">
            <div className="aspect-square md:aspect-[16/10] w-full bg-black">
                {selectedImage && (
                    <Image src={selectedImage} alt={product.name || 'Product'} fill className="object-contain" priority />
                )}
            </div>
             <div className="absolute top-4 right-4 flex gap-2">
                <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70"><Share2 className="h-5 w-5" /></Button>
                <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70"><Bookmark className="h-5 w-5" /></Button>
            </div>
            {discountPercentage > 0 && <Badge className="absolute top-4 left-4 bg-red-600 text-white font-bold">{discountPercentage}% OFF</Badge>}
        </div>
        {allImages.length > 1 && (
            <div className="container mx-auto p-2">
                <Carousel opts={{ align: "start" }} className="w-full">
                    <CarouselContent>
                    {allImages.map((img, i) => (
                        <CarouselItem key={i} className="basis-1/4 sm:basis-1/5">
                            <div className="p-1">
                                <Card onClick={() => setSelectedImage(img)} className={cn("overflow-hidden cursor-pointer", selectedImage === img && "ring-2 ring-primary")}>
                                    <CardContent className="p-0 aspect-square relative">
                                        <Image src={img} alt={`thumbnail ${i}`} fill className="object-cover" />
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
                    <StarRating rating={product.rating || 4.8} count={reviews?.length || 532} />
                    <span className="text-muted-foreground">Sold 3.2k</span>
                </div>
            </div>

            {/* 3. Price Section */}
            <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-red-600">{product.price.toLocaleString()} KES</p>
                {product.wasPrice && <p className="text-lg text-muted-foreground line-through">{product.wasPrice.toLocaleString()} KES</p>}
            </div>

            {/* 4. Delivery & Location */}
            <Card className="bg-card">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" /> <span>Ships from <strong>{product.location}</strong></span></div>
                    <div className="flex items-center gap-2 text-sm"><Truck className="h-4 w-4 text-muted-foreground" /> <span>Standard Delivery (1-2 days) - <strong className="text-primary">${product.shippingCost}</strong></span></div>
                    <div className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-muted-foreground" /> <span>7-day return policy</span></div>
                </CardContent>
            </Card>

            {/* 5. Variants & Quantity (Placeholder) */}
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
                <Card className="bg-card">
                    <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-12 w-12 border">
                            <AvatarImage src={seller.logoUrl} />
                            <AvatarFallback>{seller.shopName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="font-bold">{seller.shopName}</p>
                            <p className="text-xs text-muted-foreground">{seller.followers} followers</p>
                        </div>
                        <Button variant="outline" size="sm" asChild><Link href={`/sellers/${seller.sellerId}`}>Visit Shop</Link></Button>
                    </CardContent>
                </Card>
            )}

            <Accordion type="single" collapsible className="w-full">
                {/* 7. Product Description */}
                <AccordionItem value="description">
                    <AccordionTrigger>Product Description</AccordionTrigger>
                    <AccordionContent className="prose prose-sm dark:prose-invert">
                        {product.description}
                    </AccordionContent>
                </AccordionItem>
                {/* 8. Reviews & Ratings */}
                <AccordionItem value="reviews">
                    <AccordionTrigger>Reviews & Ratings ({reviews?.length || 0})</AccordionTrigger>
                    <AccordionContent>
                        {reviews && reviews.length > 0 ? reviews.map(r => (
                             <div key={r.id} className="py-4 border-b last:border-b-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Avatar className="h-6 w-6"><AvatarFallback>B</AvatarFallback></Avatar>
                                    <p className="text-xs font-semibold">A Buyer</p>
                                </div>
                                <StarRating rating={r.rating} />
                                <p className="mt-2 text-sm">{r.comment}</p>
                            </div>
                        )) : <p className="text-muted-foreground text-sm text-center py-8">No reviews yet.</p>}
                    </AccordionContent>
                </AccordionItem>
                {/* 9. Q&A */}
                <AccordionItem value="qa">
                    <AccordionTrigger>Questions & Answers</AccordionTrigger>
                    <AccordionContent>
                        <p className="text-muted-foreground text-sm text-center py-8">No questions have been asked yet.</p>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      </div>

      {/* 12. Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t p-2 flex items-center gap-2">
            <Button variant="ghost" size="icon"><Link href={`/sellers/${product.sellerId}`}><Store className="h-5 w-5"/></Link></Button>
            <Button variant="ghost" size="icon"><MessageSquare className="h-5 w-5" /></Button>
            <Button variant="secondary" className="flex-1">Add to Cart</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700">Buy Now</Button>
      </div>
    </MainLayout>
  );
}
