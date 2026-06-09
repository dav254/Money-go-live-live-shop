'use client';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
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
        description: "We are obsessed with growth—not just for us, but for our users. Our AI tools are designed to amplify reach and maximize sales."
    },
     {
        icon: Globe,
        title: "Global Vision",
        description: "Starting from the ground up, we are building a global marketplace that connects diverse cultures and creators, making commerce borderless."
    }
]

export default function AboutUsPage() {
    return (
        <LandingLayout>
            <div className="bg-dark-bg text-foreground">
                {/* Hero Section */}
                <section className="py-20 text-center">
                    <h1 className="font-cyber text-4xl md:text-5xl font-extrabold text-primary">About Go Earn</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                        We are building the engine for the next generation of social commerce.
                    </p>
                </section>

                {/* Mission Section */}
                <section className="py-16 bg-white/5 border-y border-white/5">
                    <div className="container mx-auto max-w-4xl text-center px-4">
                        <h2 className="font-cyber text-3xl font-bold text-white">Our Mission</h2>
                        <p className="mt-4 text-xl text-neutral-300">
                            To empower anyone to become a successful entrepreneur by turning social engagement into real earnings through an authentic, video-first marketplace.
                        </p>
                    </div>
                </section>

                {/* Our Values Section */}
                <section className="py-20">
                    <div className="container mx-auto max-w-6xl px-4">
                         <h2 className="font-cyber text-3xl font-bold text-center mb-12 text-white">Our Core Values</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {values.map((value, index) => (
                                <div key={index} className="text-center">
                                    <div className="flex justify-center mb-4">
                                        <div className="p-4 bg-primary/10 rounded-full border border-primary/20">
                                            <value.icon className="h-8 w-8 text-primary" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{value.title}</h3>
                                    <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{value.description}</p>
                                </div>
                            ))}
                         </div>
                    </div>
                </section>

                 {/* CTA Section */}
                <section className="py-24 bg-gradient-to-r from-primary/10 to-transparent">
                    <div className="container mx-auto max-w-4xl text-center px-4">
                        <h2 className="font-cyber text-3xl font-bold text-white">Join the Movement</h2>
                        <p className="mt-4 text-lg text-muted-foreground mb-8">
                            Whether you're looking to sell your products or discover unique items, your journey starts here.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Button size="lg" className="h-14 px-8 font-black uppercase tracking-widest" asChild>
                                <Link href="/signup?role=seller">Start Selling</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </LandingLayout>
    );
}
