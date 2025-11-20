
import { ResellerLayout } from '@/components/layout/reseller-layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileQuestion, MessageSquare, Search, ShieldAlert, BookOpen } from 'lucide-react';
import Link from 'next/link';

const helpArticles = [
    {
        category: "Getting Started as a Reseller",
        questions: [
            { q: "How do I pick products to resell?", a: "Navigate to the 'Products to Resell' tab. You can filter by trending, high-commission, or new arrivals to find products that suit your audience." },
            { q: "How do my commissions work?", a: "You earn a percentage of each sale made through your unique reseller link. Commissions are tracked in your 'Commissions' tab and paid out according to the payout schedule." },
            { q: "What if my sales are low?", a: "Use the 'Reseller Toolkit' to create AI-powered posters and captions. Also, check out the 'Go Earn Academy' for tips on how to improve your marketing." },
        ],
    },
    {
        category: "How to Promote Products",
        questions: [
            { q: "How do I share to WhatsApp?", a: "On each product, click the 'Share' button and select the WhatsApp option to send it directly to your contacts or status." },
            { q: "What are Go Earn Smart Links?", a: "These are special links that track every click and sale you generate. Always use the links from the 'Share' button to ensure you get your commission." },
        ],
    },
    {
        category: "Earnings & Payouts",
        questions: [
            { q: "When do I get paid?", a: "Payouts are processed weekly for all cleared commissions. A commission is 'cleared' after the order is successfully delivered and the return period has passed." },
            { q: "How is my commission calculated?", a: "The commission is a percentage of the product's price, set by the seller. You can see the exact commission rate on each product card." },
        ],
    },
];

export default function ResellerHelpCenterPage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                 <div className="flex items-center justify-between space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Help Center
                    </h1>
                    <div className="flex gap-2">
                        <Button asChild variant="outline">
                            <Link href="/dashboard/reseller/support/contact">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Contact Support
                            </Link>
                        </Button>
                         <Button asChild variant="destructive">
                            <Link href="/dashboard/reseller/support/report-issue">
                                <ShieldAlert className="mr-2 h-4 w-4" />
                                Report an Issue
                            </Link>
                        </Button>
                    </div>
                 </div>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileQuestion />
                            Knowledge Base
                        </CardTitle>
                        <CardDescription>Find answers to common reseller questions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search questions... (e.g., 'Why is my commission pending?')" className="pl-9" />
                        </div>
                        <Accordion type="single" collapsible className="w-full">
                            {helpArticles.map(category => (
                                <AccordionItem key={category.category} value={category.category}>
                                    <AccordionTrigger className="font-semibold">{category.category}</AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="space-y-4 pl-4">
                                        {category.questions.map(qa => (
                                           <li key={qa.q}>
                                                <p className="font-bold">{qa.q}</p>
                                                <p className="text-muted-foreground">{qa.a}</p>
                                           </li>
                                        ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                         <CardTitle className="flex items-center gap-2 text-primary">
                            <BookOpen />
                            Go Earn Academy
                        </CardTitle>
                        <CardDescription>Ready to level up? Visit the academy to learn from the best.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/dashboard/reseller/support/academy">
                                Go to Academy
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </ResellerLayout>
    );
}
