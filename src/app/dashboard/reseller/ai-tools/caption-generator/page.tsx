
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResellerLayout } from '@/components/layout/reseller-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Bot, Copy } from 'lucide-react';
import { generateCaption } from '@/ai/flows/generate-caption';
import { useUser } from '@/firebase';

const formSchema = z.object({
  productName: z.string().min(2, { message: 'Product name is required.' }),
  keyFeatures: z.string().min(5, { message: 'Please list at least one feature.' }),
  platform: z.enum(['TikTok', 'Instagram', 'Facebook'], { required_error: 'Please select a platform.' }),
});

export default function CaptionGeneratorPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      keyFeatures: '',
      platform: 'Instagram',
    },
  });

  const handleGenerateCaption = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in to use this feature.' });
        return;
    }
    
    setIsLoading(true);
    setGeneratedCaption('');
    try {
      const result = await generateCaption({ ...values, userId: user.uid });
      setGeneratedCaption(result.caption);
      toast({ title: 'Caption Generated!', description: 'Your new social media caption is ready.' });
    } catch (error: any) {
      console.error('Error generating caption:', error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'Could not generate caption. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCaption).then(() => {
      toast({ title: 'Copied!', description: 'Caption copied to clipboard.' });
    });
  };

  return (
    <ResellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <Bot className="text-primary" /> AI Caption Generator
              </CardTitle>
              <CardDescription>
                Describe your product and let the AI create a viral caption for social media. This costs 50 AI Points.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleGenerateCaption)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="productName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Waterproof Hiking Boots" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="keyFeatures"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key Features or Selling Points</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., All-day comfort, durable, non-slip" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Social Media Platform</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a platform" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="TikTok">TikTok</SelectItem>
                            <SelectItem value="Facebook">Facebook</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Caption
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>Generated Caption</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  value={generatedCaption}
                  readOnly
                  rows={10}
                  placeholder={isLoading ? "AI is thinking..." : "Your generated caption will appear here..."}
                  className="bg-muted"
                />
                {generatedCaption && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={handleCopy}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ResellerLayout>
  );
}
