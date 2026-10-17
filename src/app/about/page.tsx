'use client';

import { LandingLayout } from '@/components/layout/landing-layout';
import { Button } from '@/components/ui/button';
import { Globe, Handshake, Lightbulb, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const values = [
    {
        icon: Lightbulb,
        title: "Empowerment",
        description: "We believe in the power of entrepreneurship. Vidnov provides the tools for anyone, anywhere, to build a brand and achieve financial independence."
    },
    {
        icon: Handshake,
        title: "Authenticity",
        description: "In a world of filters, we champion realness. Video-first content ensures that what you see is what you get, fostering a community built on trust."
    },
    {
        icon: TrendingUp,
        title: "Growth",
        description: "We are obsessed with growth—not just for us, but for our users. Our AI tools are designed to amplify reach and maximize yield."
    },
     {
        icon: Globe,
        title: "Global Vision",
        description: "Vidnov is a boundaryless protocol connecting diverse cultures and creators, making social commerce globally accessible."
    }
]

export default function AboutUsPage() {
    return (
        <LandingLayout>
            <div className="bg-background text-foreground">
                {/* Hero Section */}
                <section className="py-20 text-center">
                    <h1 className="font-cyber text-4xl md:text-7xl font-black text-primary uppercase tracking-tighter">Vidnov Protocol</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground font-medium">
                        Engineering the next generation of global social commerce velocity.
                    </p>
                </section>

                {/* Mission Section */}
                <section className="py-16 bg-muted/30 border-y border-border">
                    <div className="container mx-auto max-w-4xl text-center px-4">
                        <h2 className="font-cyber text-3xl font-black text-foreground uppercase tracking-tight">Our Mission</h2>
                        <p className="mt-4 text-xl text-muted-foreground leading-relaxed">
                            To empower anyone to become a successful entrepreneur by turning social engagement into real financial yield through an authentic, video-first marketplace.
                        </p>
                    </div>
                </section>

                {/* Our Values Section */}
                <section className="py-20">
                    <div className="container mx-auto max-w-6xl px-4">
                         <h2 className="font-cyber text-3xl font-black text-center mb-12 uppercase tracking-tight">Core Values</h2>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {values.map((value, index) => (
                                <div key={index} className="text-center group">
                                    <div className="flex justify-center mb-6">
                                        <div className="p-5 bg-primary/5 rounded-3xl border border-primary/10 group-hover:border-primary/40 transition-all shadow-xl">
                                            <value.icon className="h-8 w-8 text-primary" />
                                        </div>
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{value.title}</h3>
                                    <p className="mt-2 text-muted-foreground text-sm font-medium leading-relaxed">{value.description}</p>
                                </div>
                            ))}
                         </div>
                    </div>
                </section>

                 {/* CTA Section */}
                <section className="py-24 bg-primary/5">
                    <div className="container mx-auto max-w-4xl text-center px-4">
                        <h2 className="font-cyber text-4xl font-black text-foreground uppercase tracking-tight">Join the Protocol</h2>
                        <p className="mt-4 text-lg text-muted-foreground mb-12 font-medium">
                            Whether you're looking to scale your brand or discover unique items, your journey begins here.
                        </p>
                        <div className="flex justify-center gap-6">
                            <Button size="lg" className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20" asChild>
                                <Link href="/signup?role=seller">START EARNING</Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </LandingLayout>
    );
}
