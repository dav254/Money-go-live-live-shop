
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Ticket, Upload, HelpCircle } from 'lucide-react';
import Link from 'next/link';

export default function ResellerContactSupportPage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Contact Support
                    </h1>
                     <Button asChild variant="outline">
                        <Link href="/dashboard/reseller/support/help-center">
                            <HelpCircle className="mr-2 h-4 w-4" />
                            Back to Help Center
                        </Link>
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare />
                                    Open a New Ticket
                                </CardTitle>
                                <CardDescription>Our team will get back to you within 24 hours.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="issue-type">What is your issue about?</Label>
                                    <Select>
                                        <SelectTrigger id="issue-type">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="commission">Commission Problem</SelectItem>
                                            <SelectItem value="payouts">Payouts & Wallet</SelectItem>
                                            <SelectItem value="links">Links & Sharing</SelectItem>
                                            <SelectItem value="account">Account Access</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="whatsapp">Your WhatsApp Number</Label>
                                    <Input id="whatsapp" placeholder="e.g., +254712345678" />
                                     <p className="text-xs text-muted-foreground">So we can reach you faster if needed.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Describe Your Issue</Label>
                                    <Textarea id="description" rows={6} placeholder="Please provide as much detail as possible, including product names, order IDs, or links if relevant." />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor="file-upload">Attach Screenshot (Optional)</Label>
                                     <Button variant="outline" className="w-full"><Upload className="mr-2 h-4 w-4" /> Upload File</Button>
                                </div>
                                <Button className="w-full font-semibold">Submit Ticket</Button>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <Card>
                             <CardHeader>
                                <CardTitle>1-Click WhatsApp Support</CardTitle>
                                <CardDescription>For urgent issues, chat with us directly.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="destructive" className="w-full">
                                    Chat on WhatsApp
                                </Button>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Ticket />
                                    My Tickets
                                </CardTitle>
                                <CardDescription>Check the status of your existing support tickets.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
                                    <p className="text-muted-foreground">You have no open tickets.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ResellerLayout>
    );
}
