import { LandingLayout } from '@/components/layout/landing-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Users, Video, DollarSign, BarChart, Rocket, Bot, Shield, CreditCard, RadioTower, Layers } from 'lucide-react';

const sellerFeatures = [
    { icon: Video, title: "Video-First Listings", description: "Showcase your products with engaging short-form videos. Build trust and convert viewers into customers." },
    { icon: BarChart, title: "Sales Analytics", description: "Track your performance with a simple dashboard. See your top products, total sales, and revenue at a glance." },
    { icon: Bot, title: "AI Seller Toolkit", description: "Use AI to generate compelling product descriptions, viral video captions, and strategic promotional ideas." },
    { icon: Rocket, title: "TikTok Boosts", description: "Pay with points to have your product videos boosted on the official Go Earn TikTok account for massive exposure." },
];

const buyerFeatures = [
    { icon: Video, title: "Authentic Product Videos", description: "See products in action before you buy. What you see is what you get, no surprises." },
    { icon: CheckCircle, title: "Verified Sellers", description: "Shop with confidence from sellers who have been verified by our team." },
    { icon: DollarSign, title: "Secure & Easy Checkout", description: "Pay securely with your preferred method and track your order status from processing to delivery." },
];

export default function FeaturesPage() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-6xl py-24 px-4">
        <div className="text-center mb-16">
          <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight text-white">Platform Features</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            Go Earn is more than just a marketplace. We're a complete ecosystem of tools designed to help you sell more and shop smarter.
          </p>
        </div>

        {/* Seller Features */}
        <div className="mb-24">
            <h2 className="font-headline text-3xl font-bold mb-8 text-center text-white">For Sellers <span className="text-primary">&</span> Entrepreneurs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                {sellerFeatures.map((feature, index) => (
                    <Card key={index} className="bg-neutral-900 border-white/5 hover:border-primary/50 hover:shadow-lg transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-white">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <feature.icon className="h-6 w-6 text-primary" />
                                </div>
                                <span>{feature.title}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-neutral-400">{feature.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>

        {/* Buyer Features */}
        <div>
             <h2 className="font-headline text-3xl font-bold mb-8 text-center text-white">For Buyers <span className="text-primary">&</span> Shoppers</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {buyerFeatures.map((feature, index) => (
                     <Card key={index} className="bg-neutral-900 border-white/5 hover:border-primary/50 hover:shadow-lg transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-white">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <feature.icon className="h-6 w-6 text-primary" />
                                </div>
                                <span>{feature.title}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-neutral-400">{feature.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>

      </div>
    </LandingLayout>
  );
}
