
'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Handshake, Lightbulb, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const values = [
    {
        icon: Lightbulb,
        title: "Empowerment",
        description: "We believe in the power of entrepreneurship. Our platform provides the tools for anyone, anywhere, to build a business and achieve financial independence."
    },
    {
        icon: Handshake,
        title: "Authenticity",
        description: "In a world of filters, we champion realness. Video-first content ensures that what you see is what you get, fostering a community built on trust."
    },
    {
        icon: TrendingUp,
        title: "Growth",
        description: "We are obsessed with growth—not just for us, but for our users. Our reseller network and AI tools are designed to amplify reach and maximize sales."
    },
     {
        icon: Globe,
        title: "Global Vision",
        description: "Starting from the ground up, we are building a global marketplace that connects diverse cultures and creators, making commerce borderless."
    }
]

export default function AboutUsPage() {
    return (
        <MainLayout>
            <div className="bg-background text-foreground">
                {/* Hero Section */}
                <section className="py-20 text-center">
                    <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-primary">About Go Earn</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                        We are building the engine for the next generation of social commerce.
                    </p>
                </section>

                {/* Mission Section */}
                <section className="py-16 bg-card/50">
                    <div className="container mx-auto max-w-4xl text-center">
                        <h2 className="font-headline text-3xl font-bold">Our Mission</h2>
                        <p className="mt-4 text-xl text-foreground/80">
                            To empower anyone to become a successful entrepreneur by turning social engagement into real earnings through an authentic, video-first marketplace.
                        </p>
                    </div>
                </section>

                {/* Our Values Section */}
                <section className="py-20">
                    <div className="container mx-auto max-w-6xl">
                         <h2 className="font-headline text-3xl font-bold text-center mb-12">Our Core Values</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {values.map((value, index) => (
                                <div key={index} className="text-center">
                                    <div className="flex justify-center mb-4">
                                        <div className="p-4 bg-primary/10 rounded-full border border-primary/20">
                                            <value.icon className="h-8 w-8 text-primary" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold">{value.title}</h3>
                                    <p className="mt-2 text-muted-foreground">{value.description}</p>
                                </div>
                            ))}
                         </div>
                    </div>
                </section>

                 {/* CTA Section */}
                <section className="py-24 bg-gradient-to-r from-primary/10 to-transparent">
                    <div className="container mx-auto max-w-4xl text-center">
                        <h2 className="font-headline text-3xl font-bold">Join the Movement</h2>
                        <p className="mt-4 text-lg text-muted-foreground mb-8">
                            Whether you're looking to sell your products, earn by reselling, or discover unique items, your journey starts here.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Button size="lg" asChild>
                                <Link href="/signup?role=seller">Start Selling</Link>
                            </Button>
                            <Button size="lg" variant="secondary" asChild>
                                <Link href="/signup?role=reseller">Start Earning</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </MainLayout>
    );
}
