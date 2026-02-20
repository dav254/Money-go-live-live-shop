'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useRef } from 'react';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, Upload, HelpCircle, User, Package, Bug, File as FileIcon, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createComplaint } from '@/app/actions/complaint-actions';

function ReportIssueForm() {
    const searchParams = useSearchParams();
    const { user } = useUser();
    const { toast } = useToast();
    
    const [issueType, setIssueType] = useState(searchParams.get('type') || 'bug');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [targetId, setTargetId] = useState('');
    
    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files)]);
        }
    };
    
    const uploadToFirebase = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const storage = getStorage();
            const storageRef = ref(storage, `support/${user?.uid}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => setUploadProgress(prev => ({ ...prev, [file.name]: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 })),
                (error) => reject(error),
                () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
            );
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !subject || !description) return toast({ variant: 'destructive', title: 'Required fields missing' });

        setIsSubmitting(true);
        try {
            const urls = await Promise.all(files.map(file => uploadToFirebase(file)));
            await createComplaint({ complainantId: user.uid, targetId: issueType === 'bug' ? 'system' : targetId, targetType: issueType === 'bug' ? 'system' : (issueType === 'order' ? 'product' : 'user'), reason: subject, description, orderId: issueType === 'order' ? targetId : undefined, uploadedFileUrls: urls } as any);
            toast({ title: 'Report Submitted' });
            setFiles([]); setSubject(''); setDescription('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Submission Failed' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert />Submit a Problem Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Report Type</Label>
                        <Select value={issueType} onValueChange={setIssueType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="buyer"><User className="mr-2 h-4 w-4" />Report a Buyer</SelectItem>
                                <SelectItem value="order"><Package className="mr-2 h-4 w-4" />Order Problem</SelectItem>
                                <SelectItem value="bug"><Bug className="mr-2 h-4 w-4" />System Bug</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea rows={6} value={description} onChange={e => setDescription(e.target.value)} /></div>
                    <div className="space-y-2">
                        <Label>Attachments</Label>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                        <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting}><Upload className="mr-2" />Add Evidence</Button>
                    </div>
                    {files.map(file => (
                        <div key={file.name} className="flex items-center gap-2 text-xs">
                            <FileIcon className="h-4 w-4" /> <span className="flex-1 truncate">{file.name}</span>
                            <Progress value={uploadProgress[file.name] || 0} className="w-24 h-1" />
                        </div>
                    ))}
                    <Button type="submit" variant="destructive" className="w-full" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" /> : 'Submit Report'}</Button>
                </CardContent>
            </form>
        </Card>
    );
}

export default function ReportIssuePage() {
    return (
        <ResellerLayout>
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between"><h1 className="font-headline text-3xl font-bold">Report an Issue</h1><Button asChild variant="outline"><Link href="/dashboard/reseller/support/help-center">Back</Link></Button></div>
                <Suspense fallback={<div>Loading...</div>}><ReportIssueForm /></Suspense>
            </div>
        </ResellerLayout>
    );
}
