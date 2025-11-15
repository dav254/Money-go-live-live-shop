
import { MainLayout } from '@/components/layout/main-layout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, FileQuestion, LifeBuoy, Mail, MessageSquare, Search, ShieldAlert, Upload, Video, BadgeHelp } from 'lucide-react';

const helpArticles = [
    {
        category: "Getting Started",
        questions: [
            { q: "How do I set up my shop?", a: "Navigate to Shop Settings > Shop Profile to enter your shop name, description, and upload a logo." },
            { q: "How do I list my first product?", a: "Go to Products > Add New. Fill in the product details, upload images, and click 'Publish Product'." },
            { q: "How do I start my first live session?", a: "Go to Live Selling, set up your title and products, then click 'Start Live' from the preview screen." },
        ],
    },
    {
        category: "Payments & Payouts",
        questions: [
            { q: "How do I withdraw my earnings?", a: "Go to the Sales & Payouts page and click the 'Withdraw Funds' button. You'll need to have a verified payment account set up." },
            { q: "What are the transaction fees?", a: "We charge a small percentage on each sale. You can find the detailed fee structure in your Revenue Statements." },
        ],
    },
    {
        category: "Reseller Center",
        questions: [
            { q: "How do I enable reselling for my products?", a: "In the Reseller Center, you can set commission rules and approve resellers who apply to promote your products." },
        ],
    },
];

const academyCourses = [
    { title: "How to Shoot Viral Product Videos", duration: "4 minutes", icon: Video },
    { title: "Live Shopping Beginner Course", duration: "8 minutes", icon: LifeBuoy },
    { title: "Double Your Sales Using Resellers", duration: "6 minutes", icon: BookOpen },
];


export default function SellerHelpPage() {
    return (
        <MainLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                 <div className="flex items-center justify-between space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Support & Help Center
                    </h1>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">

                        {/* Help Center */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileQuestion />
                                    Help Center
                                </CardTitle>
                                <CardDescription>Find answers to common questions.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search articles..." className="pl-9" />
                                </div>
                                <Accordion type="single" collapsible className="w-full">
                                    {helpArticles.map(category => (
                                        <AccordionItem key={category.category} value={category.category}>
                                            <AccordionTrigger className="font-semibold">{category.category}</AccordionTrigger>
                                            <AccordionContent>
                                                <ul className="space-y-2 pl-4">
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

                        {/* MoneyGo Academy */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-primary">
                                    <BookOpen />
                                     MoneyGo Academy
                                </CardTitle>
                                <CardDescription>Learn from the experts to grow your sales and brand.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {academyCourses.map(course => (
                                    <div key={course.title} className="relative group overflow-hidden rounded-lg border bg-background p-4 flex flex-col justify-between hover:shadow-primary/20 hover:border-primary/50 transition-all">
                                        <div>
                                            <course.icon className="h-8 w-8 text-primary mb-4" />
                                            <h3 className="font-headline font-semibold mb-2">{course.title}</h3>
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{course.duration}</span>
                                            <Button size="sm" variant="link" className="p-0 h-auto">Watch</Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-8">
                         {/* Contact Support */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare />
                                    Contact Support
                                </CardTitle>
                                <CardDescription>Can't find an answer? Reach out to us.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="issue-type">Issue Type</Label>
                                    <Select>
                                        <SelectTrigger id="issue-type">
                                            <SelectValue placeholder="Select an issue type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="payments">Payments</SelectItem>
                                            <SelectItem value="orders">Orders</SelectItem>
                                            <SelectItem value="reseller">Reseller</SelectItem>
                                            <SelectItem value="live">Live Selling</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Describe Your Issue</Label>
                                    <Textarea id="description" placeholder="Please provide as much detail as possible..." />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor="file-upload">Attach Screenshot (Optional)</Label>
                                     <Button variant="outline" className="w-full"><Upload className="mr-2 h-4 w-4" /> Upload File</Button>
                                </div>
                                <Button className="w-full">Submit Ticket</Button>
                            </CardContent>
                        </Card>

                        {/* Report an Issue */}
                        <Card>
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldAlert />
                                    Report an Issue
                                </CardTitle>
                                <CardDescription>Quick reports for urgent problems.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button variant="outline" className="w-full justify-start gap-2"><BadgeHelp className="h-4 w-4"/> Report Buyer</Button>
                                <Button variant="outline" className="w-full justify-start gap-2"><BadgeHelp className="h-4 w-4"/> Report Order Problem</Button>
                                <Button variant="outline" className="w-full justify-start gap-2"><BadgeHelp className="h-4 w-4"/> Report System Bug</Button>
                            </CardContent>
                        </Card>
                    </div>
                 </div>
            </div>
        </MainLayout>
    );
}
