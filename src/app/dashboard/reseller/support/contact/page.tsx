'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Ticket, Upload, HelpCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, errorEmitter } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  issueType: z.string({ required_error: 'Please select an issue type.' }),
  whatsappNumber: z.string().optional(),
  description: z.string().min(10, 'Please provide a detailed description.'),
});

export default function ResellerContactSupportPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            issueType: '',
            whatsappNumber: '',
            description: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to submit a ticket.' });
            return;
        }
        setIsSubmitting(true);
        
        const ticketData = {
            userId: user.uid,
            issueType: values.issueType,
            description: values.description,
            contactNumber: values.whatsappNumber,
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        try {
            const ticketsCollectionRef = collection(firestore, 'supportTickets');
            await addDoc(ticketsCollectionRef, ticketData);
            toast({ title: 'Ticket Submitted', description: 'Our support team will get back to you shortly.' });
            form.reset();
        } catch (error) {
            errorEmitter.emit(
                'permission-error',
                new FirestorePermissionError({
                    path: 'supportTickets',
                    operation: 'create',
                    requestResourceData: ticketData,
                })
            );
            toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your ticket. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    }


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
                             <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <MessageSquare />
                                            Open a New Ticket
                                        </CardTitle>
                                        <CardDescription>Our team will get back to you within 24 hours.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <FormField
                                            control={form.control}
                                            name="issueType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>What is your issue about?</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a category" />
                                                        </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="commission">Commission Problem</SelectItem>
                                                            <SelectItem value="payouts">Payouts & Wallet</SelectItem>
                                                            <SelectItem value="links">Links & Sharing</SelectItem>
                                                            <SelectItem value="account">Account Access</SelectItem>
                                                            <SelectItem value="other">Other</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="whatsappNumber"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Your WhatsApp Number</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., +254712345678" {...field} />
                                                    </FormControl>
                                                    <FormDescription>So we can reach you faster if needed.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                 <FormItem>
                                                    <FormLabel>Describe Your Issue</FormLabel>
                                                    <FormControl>
                                                        <Textarea rows={6} placeholder="Please provide as much detail as possible, including product names, order IDs, or links if relevant." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="space-y-2">
                                            <Label htmlFor="file-upload">Attach Screenshot (Optional)</Label>
                                            <Button variant="outline" className="w-full" type="button"><Upload className="mr-2 h-4 w-4" /> Upload File</Button>
                                        </div>
                                        <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Submit Ticket
                                        </Button>
                                    </CardContent>
                                </form>
                            </Form>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <Card>
                             <CardHeader>
                                <CardTitle>1-Click WhatsApp Support</CardTitle>
                                <CardDescription>For urgent issues, chat with us directly.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild variant="destructive" className="w-full">
                                    <a href="https://wa.me/254712345678" target="_blank" rel="noopener noreferrer">
                                        Chat on WhatsApp
                                    </a>
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
