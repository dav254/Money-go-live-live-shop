
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Upload, HelpCircle } from 'lucide-react';
import Link from 'next/link';


export default function ResellerReportIssuePage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-8 p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h1 className="font-headline text-3xl font-bold tracking-tight">
                        Report an Issue
                    </h1>
                     <Button asChild variant="outline">
                        <Link href="/dashboard/reseller/support/help-center">
                            <HelpCircle className="mr-2 h-4 w-4" />
                            Back to Help Center
                        </Link>
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <ShieldAlert />
                            Submit a Platform Problem Report
                        </CardTitle>
                        <CardDescription>Use this form for urgent platform problems. Our technical team will be alerted immediately.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="issue-category">Issue Category</Label>
                            <Select>
                                <SelectTrigger id="issue-category">
                                    <SelectValue placeholder="Select the type of problem" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="product-loading">Product Not Loading</SelectItem>
                                    <SelectItem value="sales-not-updating">Sales Not Updating</SelectItem>
                                    <SelectItem value="commission-missing">Commission Missing</SelectItem>
                                    <SelectItem value="sharing-problem">Problem Sharing Product (IG, TikTok, FB)</SelectItem>
                                    <SelectItem value="link-not-working">Reseller Link Not Working</SelectItem>
                                    <SelectItem value="app-bug">App Bug / Glitch</SelectItem>
                                    <SelectItem value="wrong-info">Wrong Seller Product Info</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                         <div className="space-y-2">
                            <Label>Priority</Label>
                             <RadioGroup defaultValue="medium" className="flex gap-6 pt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="low" id="p1" />
                                    <Label htmlFor="p1">Low</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="medium" id="p2" />
                                    <Label htmlFor="p2">Medium</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="urgent" id="p3" />
                                    <Label htmlFor="p3" className="font-bold text-destructive">Urgent</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        
                        <div className="space-y-2">
                            <Label htmlFor="description">Short Description</Label>
                            <Textarea id="description" placeholder="Briefly explain what's happening..." />
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="file-upload">Attach Screenshot</Label>
                             <Button variant="outline" className="w-full"><Upload className="mr-2 h-4 w-4" /> Upload Screenshot</Button>
                        </div>
                        <Button variant="destructive" className="w-full font-semibold">Submit Urgent Report</Button>
                    </CardContent>
                </Card>
            </div>
        </ResellerLayout>
    );
}
