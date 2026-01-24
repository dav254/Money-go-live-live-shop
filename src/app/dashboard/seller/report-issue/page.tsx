'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useRef } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Upload, HelpCircle, User, Package, Bug, File as FileIcon, X } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { createComplaint } from '@/app/actions/complaint-actions';
import { useUser } from '@/firebase';

function ReportIssueForm() {
    const searchParams = useSearchParams();
    const issueType = searchParams.get('type') || 'bug';
    const { toast } = useToast();
    const { user } = useUser();
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [targetId, setTargetId] = useState('');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            setFiles((prev) => [...prev, ...newFiles]);
        }
    };
    
    const handleFileRemove = (fileName: string) => {
        setFiles((prev) => prev.filter((file) => file.name !== fileName));
    };

    const uploadToCloudinary = async (file: File): Promise<{ url: string, type: string }> => {
        const timestamp = Math.round((new Date()).getTime() / 1000);
        const paramsToSign = { timestamp };

        const signatureResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paramsToSign }),
        });
        const { signature } = await signatureResponse.json();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
        formData.append('timestamp', timestamp.toString());
        formData.append('signature', signature);
        
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', uploadUrl, true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100;
                    setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const uploadedData = JSON.parse(xhr.responseText);
                    resolve({ url: uploadedData.secure_url, type: file.type });
                } else {
                    reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload.'));
            xhr.send(formData);
        });
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to submit a report.'});
            return;
        }
        if (!subject || !description) {
            toast({ variant: 'destructive', title: 'Please fill out all required fields.' });
            return;
        }
        
        setIsUploading(true);
        toast({ title: 'Submitting Report...', description: 'Please wait.' });

        try {
            const uploadedFileUrls = (await Promise.all(files.map(file => uploadToCloudinary(file)))).map(f => f.url);

            const payload = {
                complainantId: user.uid,
                targetId: issueType === 'bug' ? 'system' : targetId,
                targetType: issueType === 'bug' ? 'system' : (issueType === 'order' ? 'product' : 'user'),
                reason: subject,
                description,
                orderId: issueType === 'order' ? targetId : undefined,
                uploadedFileUrls,
            };

            const result = await createComplaint(payload as any);

            if (result.success) {
                toast({ title: 'Report Submitted', description: 'Thank you for your feedback. Our team will review it shortly.' });
                setFiles([]);
                setUploadProgress({});
            } else {
                throw new Error(result.error || 'Failed to submit report.');
            }
        } catch (error: any) {
            console.error("Error submitting report:", error);
            toast({ variant: 'destructive', title: 'Submission Failed', description: error.message || 'Could not submit your report. Please try again.' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
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
                        <Label htmlFor="file-upload">Attach Screenshots or Evidence</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileChange}
                            disabled={isUploading}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {isUploading ? 'Uploading...' : 'Choose File(s)'}
                        </Button>
                    </div>
                    
                    {files.length > 0 && (
                        <div className="space-y-4">
                            <Label>Selected Files</Label>
                            {files.map(file => (
                                <div key={file.name} className="flex items-center gap-3 rounded-md border p-2">
                                    <FileIcon className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="truncate text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                                        {uploadProgress[file.name] !== undefined && (
                                            <Progress value={uploadProgress[file.name]} className="h-1 mt-1" />
                                        )}
                                    </div>
                                     <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground"
                                        onClick={() => handleFileRemove(file.name)}
                                        disabled={isUploading}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <Button type="submit" variant="destructive" className="w-full font-semibold" disabled={isUploading}>
                        {isUploading ? 'Submitting...' : 'Submit Report'}
                    </Button>
                </CardContent>
            </form>
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
