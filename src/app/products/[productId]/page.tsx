
'use client';

import React, { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
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
  Video,
} from 'lucide-react';
import { ProductCard } from '@/components/seller/product-card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';


// --- MOCKED DATA FOR FRONTEND DEMO ---
const product: Product = {
    id: 'YglRWMtC0BIBFFXyA8FC',
    name: 'Futuristic Glow Sneakers',
    price: 1499,
    wasPrice: 2199,
    category: 'Footwear',
    stock: 3,
    description: "Step into the future with the new GlowRunners. Featuring a unique light-reactive fabric and ultra-comfortable sole, these sneakers aren't just for show—they're built for performance. Perfect for night runs or making a statement wherever you go.",
    imageUrls: [
        'https://picsum.photos/seed/sneaker1/1000/1000',
        'https://picsum.photos/seed/sneaker2/1000/1000',
        'https://picsum.photos/seed/sneaker3/1000/1000',
    ],
    videoUrls: [
        // Placeholder for video
    ],
    sellerId: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
    tags: '#sneakers, #glow, #running, #fashion, #new'
};

const seller = {
    id: 'CKmHD5jv0dOevUJhJ8tM7akpSlF2',
    shopName: 'Urban Kicks',
    logoUrl: 'https://picsum.photos/seed/shoplogo/200',
    rating: 4.9,
    followers: '25.8K',
    responseRate: '98%',
    onlineStatus: 'online'
};

const reviews = [
    { id: 1, author: 'Jane D.', rating: 5, comment: 'Best sneakers I have ever owned! Super comfortable and they look amazing at night.', date: '2 days ago', photos: ['https://picsum.photos/seed/review1/200'] },
    { id: 2, author: 'Mike K.', rating: 4, comment: 'Great shoes, very stylish. A bit tight at first but they get comfortable.', date: '1 week ago', photos: [] },
];

const recommendedProducts: Product[] = [
    { id: 'rec-1', name: 'Cyberpunk Jacket', price: 2500, imageUrl: 'https://picsum.photos/seed/rec1/400', stock: 10, sellerId: 'seller-2' },
    { id: 'rec-2', name: 'LED Visor', price: 800, imageUrl: 'https://picsum.photos/seed/rec2/400', stock: 25, sellerId: 'seller-3' },
    { id: 'rec-3', name: 'Holographic Backpack', price: 1800, imageUrl: 'https://picsum.photos/seed/rec3/400', stock: 5, sellerId: 'seller-4' },
    { id: 'rec-4', name: 'Gamer Hoodie', price: 1200, imageUrl: 'https://picsum.photos/seed/rec4/400', stock: 30, sellerId: 'seller-5' },
];

// --- END MOCKED DATA ---

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


export default function BuyerProductPage() {
    const allMedia = [
        ...(product.videoUrls || []).map(url => ({ url, type: 'video' as 'video' })),
        ...(product.imageUrls || []).map(url => ({ url, type: 'image' as 'image' })),
    ];
    const [selectedMedia, setSelectedMedia] = useState(allMedia[0] || { url: 'https://picsum.photos/seed/placeholder/1000/1000', type: 'image' });
    const discountPercentage = product.wasPrice ? Math.round(((product.wasPrice - product.price) / product.wasPrice) * 100) : 0;

    return (
        <MainLayout>
            <div className="bg-black text-white pb-24">
                {/* 1. Product Media Section */}
                <div className="relative w-full">
                    <div className="aspect-square md:aspect-[16/10] w-full bg-black">
                        {selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.url} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                        ) : (
                            <Image src={selectedMedia.url} alt={product.name} fill className="object-contain" priority />
                        )}
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2">
                        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70"><Share2 className="h-5 w-5" /></Button>
                        <Button size="icon" variant="secondary" className="rounded-full bg-black/50 hover:bg-black/70"><Bookmark className="h-5 w-5" /></Button>
                    </div>
                    {discountPercentage > 0 && <Badge className="absolute top-4 left-4 bg-red-500 text-white font-bold">{discountPercentage}% OFF</Badge>}
                </div>
                {allMedia.length > 1 && (
                    <div className="bg-neutral-900 py-2">
                        <Carousel opts={{ align: "start" }} className="w-full container px-0">
                            <CarouselContent className="-ml-1">
                                {allMedia.map((media, i) => (
                                    <CarouselItem key={i} className="basis-1/4 sm:basis-1/5 pl-1">
                                        <Card onClick={() => setSelectedMedia(media)} className={cn("overflow-hidden cursor-pointer bg-neutral-800", selectedMedia.url === media.url && "ring-2 ring-red-500")}>
                                            <CardContent className="p-0 aspect-square relative">
                                                <Image src={media.url} alt={`thumbnail ${i}`} fill className="object-cover" />
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
                            <StarRating rating={4.8} count={532} />
                            <span className="text-neutral-400">Sold 3.2K</span>
                        </div>
                    </div>

                    {/* 3. Price Section */}
                    <div className="flex items-end gap-3">
                        <p className="text-3xl font-bold text-red-500">KES {product.price.toLocaleString()}</p>
                        {product.wasPrice && <p className="text-lg text-neutral-500 line-through">KES {product.wasPrice.toLocaleString()}</p>}
                        {discountPercentage > 0 && <Badge variant="destructive" className="font-bold">-{discountPercentage}%</Badge>}
                    </div>

                    {/* 4. Delivery & Location Section */}
                    <Card className="bg-[#2a2a2a] border-neutral-800">
                        <CardContent className="p-4 space-y-3 text-sm">
                            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-neutral-400" /> <span>Ships to <strong>Nairobi, Kenya</strong></span> <Button variant="link" className="p-0 h-auto text-red-500">Change</Button></div>
                            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-neutral-400" /> <span>Standard Delivery (1-2 days) - <strong className="text-white">KES 300</strong></span></div>
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
                    {product.stock <= 5 && <p className="text-red-500 text-sm font-semibold">Only {product.stock} left in stock!</p>}

                    {/* 6. Seller Shop Info Block */}
                    <Card className="bg-[#2a2a2a] border-neutral-800">
                        <CardContent className="p-4 flex items-center gap-4">
                            <Avatar className="h-12 w-12 border"><AvatarImage src={seller.logoUrl} /><AvatarFallback>{seller.shopName?.charAt(0)}</AvatarFallback></Avatar>
                            <div className="flex-1">
                                <p className="font-bold">{seller.shopName}</p>
                                <p className="text-xs text-neutral-400">{seller.followers} followers</p>
                            </div>
                            <Button variant="outline" size="sm" className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600">Follow</Button>
                            <Button variant="outline" size="sm" className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600">Visit Shop</Button>
                        </CardContent>
                    </Card>

                    <Accordion type="single" collapsible className="w-full" defaultValue="description">
                        {/* 7. Product Description */}
                        <AccordionItem value="description">
                            <AccordionTrigger>Product Description</AccordionTrigger>
                            <AccordionContent className="prose prose-sm dark:prose-invert text-neutral-300">{product.description}</AccordionContent>
                        </AccordionItem>
                        {/* 8. Reviews & Ratings */}
                        <AccordionItem value="reviews">
                            <AccordionTrigger>Reviews & Ratings ({reviews.length})</AccordionTrigger>
                            <AccordionContent>
                                {/* Placeholder Content */}
                                <p className="text-neutral-400 text-center py-4">Detailed reviews section coming soon.</p>
                            </AccordionContent>
                        </AccordionItem>
                        {/* 9. Q&A */}
                        <AccordionItem value="qa">
                            <AccordionTrigger>Questions & Answers</AccordionTrigger>
                            <AccordionContent><p className="text-neutral-400 text-sm text-center py-4">No questions yet.</p></AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    
                    {/* 10. Recommended From This Seller */}
                    <div>
                        <h2 className="font-headline text-xl font-bold mt-8 mb-4">More from {seller.shopName}</h2>
                        {/* <ProductGrid products={recommendedProducts} /> */}
                        <p className="text-neutral-400 text-sm">Recommended products will appear here.</p>
                    </div>
                </div>
            </div>

            {/* 12. Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-t border-neutral-800 p-2 flex items-center gap-2">
                <div className="flex flex-col items-center">
                    <Button variant="ghost" size="icon"><Store className="h-5 w-5 text-neutral-300"/></Button>
                    <span className="text-xs text-neutral-400">Shop</span>
                </div>
                <div className="flex flex-col items-center">
                    <Button variant="ghost" size="icon"><MessageSquare className="h-5 w-5 text-neutral-300" /></Button>
                     <span className="text-xs text-neutral-400">Chat</span>
                </div>
                <Button variant="secondary" className="flex-1 bg-[#2a2a2a] text-white">Add to Cart</Button>
                <Button className="flex-1 bg-red-500 hover:bg-red-600">Buy Now</Button>
            </div>
        </MainLayout>
    );
}
