
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Upload, HelpCircle, User, Package, Bug } from 'lucide-react';
import Link from 'next/link';

function ReportIssueForm() {
    const searchParams = useSearchParams();
    const issueType = searchParams.get('type') || 'bug';

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <ShieldAlert />
                    Submit a Report
                </CardTitle>
                <CardDescription>
                    Your report will be sent to our moderation and technical teams for review.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="issue-type">Report Type</Label>
                    <Select defaultValue={issueType}>
                        <SelectTrigger id="issue-type">
                            <SelectValue placeholder="Select a report type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="buyer"><User className="mr-2 h-4 w-4" />Report a Buyer</SelectItem>
                            <SelectItem value="order"><Package className="mr-2 h-4 w-4" />Report an Order Problem</SelectItem>
                            <SelectItem value="bug"><Bug className="mr-2 h-4 w-4" />Report a System Bug</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                {issueType === 'buyer' && (
                    <div className="space-y-2">
                        <Label htmlFor="buyer-id">Buyer Username or ID</Label>
                        <Input id="buyer-id" placeholder="Enter the buyer's username or profile ID" />
                    </div>
                )}

                {issueType === 'order' && (
                    <div className="space-y-2">
                        <Label htmlFor="order-id">Order ID</Label>
                        <Input id="order-id" placeholder="Enter the relevant Order ID (e.g., #ORD-12345)" />
                    </div>
                )}
                
                <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" placeholder="A brief summary of the issue" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Detailed Description</Label>
                    <Textarea
                        id="description"
                        rows={8}
                        placeholder="Please provide as much detail as possible. What happened? What did you expect to happen? Include steps to reproduce if it's a bug."
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="file-upload">Attach Screenshots or Evidence (Optional)</Label>
                    <Button variant="outline" className="w-full">
                        <Upload className="mr-2 h-4 w-4" /> Upload File(s)
                    </Button>
                </div>
                <Button variant="destructive" className="w-full font-semibold">
                    Submit Report
                </Button>
            </CardContent>
        </Card>
    );
}

export default function ReportIssuePage() {
    return (
        <SellerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Report an Issue
                    </h1>
                     <Button asChild variant="outline">
                        <Link href="/dashboard/seller/help">
                            <HelpCircle className="mr-2 h-4 w-4" />
                            Back to Help Center
                        </Link>
                    </Button>
                </div>
                <Suspense fallback={<div>Loading form...</div>}>
                    <ReportIssueForm />
                </Suspense>
            </div>
        </SellerLayout>
    );
}
