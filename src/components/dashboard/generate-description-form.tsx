'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { generateProductDescription } from '@/ai/flows/generate-product-description';
import { useState } from 'react';
import { Loader2, Sparkles, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

const formSchema = z.object({
  productName: z.string().min(2, { message: 'Product name is required.' }),
  productCategory: z.string().min(2, { message: 'Product category is required.' }),
  keyFeatures: z.string().min(10, { message: 'Please list at least one key feature.' }),
  targetAudience: z.string().min(2, { message: 'Target audience is required.' }),
  tone: z.string().min(2, { message: 'Tone is required.' }),
});

export function GenerateDescriptionForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      productCategory: '',
      keyFeatures: '',
      targetAudience: '',
      tone: 'Exciting',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'You must be logged in to use this feature.',
        });
        return;
    }
    
    setIsLoading(true);
    setGeneratedDescription('');
    try {
      const result = await generateProductDescription({
          ...values,
          userId: user.uid,
      });
      setGeneratedDescription(result.description);
      toast({ title: 'Success!', description: 'A new product description has been generated.' });
    } catch (error: any) {
      console.error('Failed to generate description:', error);
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'There was an error generating the product description. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDescription).then(() => {
      toast({ title: 'Copied!', description: 'The description has been copied to your clipboard.' });
    }, (err) => {
      console.error('Could not copy text: ', err);
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy the description to your clipboard.' });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center gap-2">
          <Sparkles className="text-primary" />
          AI Product Description Generator
        </CardTitle>
        <CardDescription>
          Fill in your product details and let our AI create a compelling description for you. This tool costs 25 points per generation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Classic Leather Handbag" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="productCategory"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Product Category</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Fashion Accessories" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="keyFeatures"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key Features (comma-separated)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., 100% Genuine Leather, Hand-stitched, Multiple compartments" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Target Audience</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Professional women, Students" {...field} />
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
                    <FormLabel>Desired Tone</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Professional, Funny, Exciting" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate (25 Points)
                </>
              )}
            </Button>
          </form>
        </Form>
        
        {generatedDescription && (
            <div className="mt-8 pt-6 border-t">
                <h3 className="font-headline text-lg font-semibold">Generated Description:</h3>
                <div className="mt-2 p-4 bg-muted/50 rounded-md whitespace-pre-wrap text-sm">
                    {generatedDescription}
                </div>
                 <Button variant="outline" className="mt-4" onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Description
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
