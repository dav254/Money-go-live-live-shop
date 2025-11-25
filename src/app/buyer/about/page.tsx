
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShoppingCart, Video, MessageSquare, MapPin, Bookmark, Bell, ShoppingBag, Truck, Package, Sparkles } from 'lucide-react';
import Link from 'next/link';

const buyerBenefits = [
    { icon: ShoppingCart, title: "Shop Products Instantly", description: "Swipe through videos and images, see real product previews, and click to buy immediately." },
    { icon: Video, title: "Live Shopping Experience", description: "Watch sellers sell live, ask questions in real time, and get exclusive live discounts." },
    { icon: MessageSquare, title: "Chat Directly With Sellers", description: "No middleman. Get instant replies and build trust with our secure chat system." },
    { icon: MapPin, title: "Location-Based Shopping", description: "See products near you for faster ordering and lower delivery costs." },
    { icon: Bookmark, title: "Save What You Like", description: "Bookmark videos and save products to your wishlist for easy access later." },
    { icon: Bell, title: "Real-Time Notifications", description: "Get updates on price drops, new products, seller discounts, and delivery status." },
];

const platformHighlights = [
    "We support real hustlers & sellers",
    "0% cost to browse or list",
    "No scam sellers (all verified)",
    "Simple UI like TikTok",
    "Fast delivery & trusted vendors",
    "Secure payments",
];

const offerIcons = [
    { icon: ShoppingBag, text: "Thousands of products" },
    { icon: Truck, text: "Fast delivery" },
    { icon: Package, text: "Secure orders" },
    { icon: MessageSquare, text: "Real chats" },
];

export default function BuyerAboutPage() {
    const buyerName = "Buyer"; // Placeholder, will be dynamic later

    return (
        <BuyerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 bg-black text-white">
                
                {/* Welcome Header */}
                <div className="text-center space-y-2 py-8">
                    <h1 className="font-headline text-4xl font-extrabold tracking-tight text-white">
                        🎉 Welcome to Go Earn, Your New Shopping Home!
                    </h1>
                     <div className="flex justify-center">
                        <div className="h-1 w-24 bg-primary rounded-full"></div>
                    </div>
                </div>

                {/* Personalized Greeting */}
                <div className="text-center">
                    <h2 className="font-headline text-3xl font-bold">Hi, {buyerName}! Let’s make your shopping faster, smarter and more fun.</h2>
                    <p className="text-md text-neutral-300 mt-2 max-w-2xl mx-auto">
                        Discover products from real sellers, watch live shopping videos, chat directly, and shop safely with fast delivery.
                    </p>
                </div>

                 {/* Benefits Section */}
                <div className="py-8">
                    <h3 className="font-headline text-2xl font-bold text-center mb-6">This is What You Can Do on Go Earn</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {buyerBenefits.map((item, index) => (
                            <Card key={index} className="bg-neutral-900 border-neutral-800 hover:border-primary/50 hover:shadow-lg transition-all text-white">
                                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                    <div className="p-3 bg-primary/10 rounded-lg">
                                        <item.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <CardTitle className="font-headline text-lg">{item.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-neutral-400">{item.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                 {/* Grow with Go Earn & Highlights */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-8">
                     <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline text-2xl">
                                <Sparkles className="text-primary"/>
                                Why Go Earn is Different
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {platformHighlights.map((point, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <CheckCircle className="h-5 w-5 text-primary" />
                                    <span className="text-base text-neutral-200">{point}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                     <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader>
                            <CardTitle className="font-headline text-2xl">What We Offer</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 pt-6">
                           {offerIcons.map((item, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 p-4 bg-neutral-800/50 rounded-lg text-center">
                                    <item.icon className="h-8 w-8 text-primary" />
                                    <span className="text-sm font-medium text-neutral-200">{item.text}</span>
                                </div>
                           ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Seller Info Section */}
                <div className="text-center py-8">
                     <h3 className="font-headline text-2xl font-bold">Real Sellers, Real Videos.</h3>
                     <p className="text-neutral-300 mt-2">Sellers upload real videos so you see the product exactly as it is. No lies. No edits. Pure authenticity.</p>
                </div>

                {/* Call to Action */}
                <div className="text-center pt-8 space-y-4 border-t border-neutral-800">
                    <h2 className="font-headline text-2xl font-bold">Ready to Dive In?</h2>
                     <div className="flex flex-col sm:flex-row justify-center gap-4">
                         <Button size="lg" className="font-bold bg-primary hover:bg-primary/90 text-lg py-6 px-8 rounded-xl" asChild>
                             <Link href="/buyer/dashboard">Start Shopping</Link>
                         </Button>
                         <Button size="lg" variant="outline" className="font-bold border-primary text-primary hover:bg-primary/10 hover:text-primary text-lg py-6 px-8 rounded-xl" asChild>
                              <Link href="/live">Watch Live Streams</Link>
                         </Button>
                     </div>
                </div>

            </div>
        </BuyerLayout>
    );
}
