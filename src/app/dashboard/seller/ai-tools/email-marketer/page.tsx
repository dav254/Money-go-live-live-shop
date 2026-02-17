
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Copy, Mail, Send } from 'lucide-react';
import { generateMarketingEmail } from '@/ai/flows/generate-marketing-email';
import { useUser, useUserProfile } from '@/firebase';

const formSchema = z.object({
  productName: z.string().optional(),
  goal: z.enum(['Product Launch', 'Sale Announcement', 'Thank You / Follow-up', 'Customer Win-back']),
  tone: z.string().min(2, { message: 'Please specify a tone.' }),
});

export default function EmailMarketerPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      goal: 'Sale Announcement',
      tone: 'Friendly & Persuasive',
    },
  });

  const handleGenerateEmail = async (values: z.infer<typeof formSchema>) => {
    if (!user || !userProfile) {
        toast({ variant: 'destructive', title: 'Authentication Error' });
        return;
    }
    
    setIsLoading(true);
    setGeneratedSubject('');
    setGeneratedBody('');
    
    try {
      const result = await generateMarketingEmail({ 
          ...values, 
          userId: user.uid,
          sellerName: userProfile.shopName || userProfile.fullName
      });
      setGeneratedSubject(result.subject);
      setGeneratedBody(result.body);
      toast({ title: 'Email Generated!', description: 'Your marketing content is ready.' });
    } catch (error: any) {
      console.error('Error generating email:', error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied!', description: `${label} copied to clipboard.` });
    });
  };

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <Mail className="text-primary" /> AI Email Marketer
              </CardTitle>
              <CardDescription>
                Generate high-converting emails to send to your customers. This costs 40 AI Points.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleGenerateEmail)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="goal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Goal</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a goal" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Sale Announcement">Sale Announcement</SelectItem>
                            <SelectItem value="Product Launch">Product Launch</SelectItem>
                            <SelectItem value="Thank You / Follow-up">Thank You / Follow-up</SelectItem>
                            <SelectItem value="Customer Win-back">Customer Win-back</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Premium Leather Belt" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Tone</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Professional, Urgent, Excited" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Email (40 Points)
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6 sticky top-24">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Subject Line</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <Input value={generatedSubject} readOnly placeholder="Subject will appear here..." className="pr-10" />
                        {generatedSubject && (
                            <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => handleCopy(generatedSubject, 'Subject')}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg text-primary">Email Body</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative">
                        <Textarea
                        value={generatedBody}
                        readOnly
                        rows={12}
                        placeholder={isLoading ? "AI is crafting your message..." : "Your generated email body will appear here..."}
                        className="bg-muted text-sm leading-relaxed"
                        />
                        {generatedBody && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => handleCopy(generatedBody, 'Body')}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                        )}
                    </div>
                </CardContent>
                {generatedBody && (
                    <CardFooter>
                        <div className="w-full bg-primary/10 p-3 rounded-lg border border-primary/20 flex items-center justify-between">
                            <span className="text-xs font-bold text-primary uppercase">Ready to send?</span>
                            <Button size="sm" variant="ghost" className="font-black text-[10px] uppercase gap-2 hover:bg-primary hover:text-white" disabled>
                                <Send className="h-3 w-3" /> Connect SMTP to Enable
                            </Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
