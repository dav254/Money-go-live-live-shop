
'use client';

import React, { useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { generatePoster } from '@/ai/flows/generate-poster-flow';
import Image from 'next/image';

export default function AIPosterGeneratorPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const selectedProduct = useMemo(() => {
    return products?.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const handleGeneratePoster = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in.' });
        return;
    }
    if (!selectedProduct || !prompt) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please select a product and provide a prompt.' });
        return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl(null);
    toast({ title: 'Generating Poster...', description: 'The AI is creating your image. This might take a moment.' });
    
    try {
        const result = await generatePoster({
            userId: user.uid,
            productName: selectedProduct.name,
            productDescription: selectedProduct.description || '',
            productImageUrl: selectedProduct.imageUrl || '',
            prompt: prompt,
        });

        setGeneratedImageUrl(result.imageUrl);
        toast({ title: 'Poster Generated!', description: 'Your new promotional poster is ready.' });
    } catch (error: any) {
        console.error("Error generating poster:", error);
        toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'Could not generate the poster.' });
    } finally {
        setIsGenerating(false);
    }
  };


  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
              <ImageIcon className="text-primary" /> AI Poster Generator
            </CardTitle>
            <CardDescription>
              Select a product and describe the poster you want. The AI will generate a promotional image for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">1. Select a Product</label>
                <Select
                  onValueChange={setSelectedProductId}
                  value={selectedProductId || ''}
                  disabled={areProductsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={areProductsLoading ? "Loading products..." : "Select a product to feature"} />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">2. Describe Your Poster</label>
                <Textarea
                  rows={8}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Be descriptive! For example: 'A vibrant, cartoon-style poster showing the handbag on a sunny beach, with the text 'Summer Sale!' at the top. Use bright yellows and blues.'"
                />
              </div>
              <Button
                onClick={handleGeneratePoster}
                disabled={isSubmitting || !selectedProductId || !prompt}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Poster (150 Points)
              </Button>
            </div>
            <div className="space-y-4">
                <Label>Generated Image</Label>
                 <div className="aspect-square w-full bg-muted rounded-lg flex items-center justify-center border-dashed border-2">
                    {isGenerating ? (
                        <div className="text-center text-muted-foreground">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                            <p className="mt-2">Generating...</p>
                        </div>
                    ) : generatedImageUrl ? (
                        <Image src={generatedImageUrl} alt="Generated poster" fill className="object-contain rounded-lg" />
                    ) : (
                        <p className="text-muted-foreground">Your poster will appear here</p>
                    )}
                 </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
