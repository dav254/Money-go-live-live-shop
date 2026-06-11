import { LandingLayout } from '@/components/layout/landing-layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';

const faqs = [
    {
        category: "For Buyers",
        questions: [
            {
                q: "How do I place an order?",
                a: "Simply browse products through the video feed or categories. When you find something you like, click the 'Add to Cart' or 'Buy Now' button. You can then proceed to checkout from your cart."
            },
            {
                q: "Is my payment secure?",
                a: "Yes. All payments are processed through secure, PCI-compliant gateways like Paystack and PayPal. We do not store your credit card information on our servers."
            },
             {
                q: "How can I track my order?",
                a: "You can track the status of your order in the 'My Orders' section of your dashboard. You'll receive notifications when your order is processed, shipped, and out for delivery."
            }
        ]
    },
    {
        category: "For Sellers",
        questions: [
            {
                q: "How much does it cost to sell on Go Earn?",
                a: "Listing products is completely free. We only charge a small commission (typically 10%) on successful sales. There are no monthly fees or hidden charges."
            },
            {
                q: "How do I get paid?",
                a: "Once an order is successfully delivered and confirmed by the buyer, the funds (minus our commission) are added to your wallet. You can then request a payout to your linked bank account or PayPal."
            },
             {
                q: "How can I increase my sales?",
                a: "Uploading high-quality videos of your products is the best way to increase trust and sales. Also, consider using our AI Tools to create better content."
            }
        ]
    }
];

export default function FAQPage() {
    return (
        <LandingLayout>
            <div className="container mx-auto max-w-4xl py-24">
                <div className="text-center mb-12">
                    <h1 className="font-headline text-4xl font-bold tracking-tight">Frequently Asked Questions</h1>
                    <p className="mt-4 text-lg text-muted-foreground">Find answers to the most common questions about Go Earn.</p>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <HelpCircle />
                           Browse by Category
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {faqs.map(categoryItem => (
                                <AccordionItem key={categoryItem.category} value={categoryItem.category}>
                                    <AccordionTrigger className="text-lg font-semibold">{categoryItem.category}</AccordionTrigger>
                                    <AccordionContent className="space-y-6 pt-2">
                                        {categoryItem.questions.map((qa, index) => (
                                            <div key={index}>
                                                <h4 className="font-bold text-base">{qa.q}</h4>
                                                <p className="text-muted-foreground mt-1">{qa.a}</p>
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>
        </LandingLayout>
    )
}
