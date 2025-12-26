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
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AIPosterGeneratorPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'products'), where('sellerId', '==', user.uid));
  }, [firestore, user]);

  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const handleSubmitRequest = async () => {
    if (!user) {
        toast({ variant: 'destructive', title: 'You must be logged in.' });
        return;
    }
    if (!selectedProductId || !prompt) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please select a product and provide a prompt.' });
        return;
    }

    setIsSubmitting(true);
    try {
        const requestsCollectionRef = collection(firestore, 'aiPosterRequests');
        await addDoc(requestsCollectionRef, {
            userId: user.uid,
            productId: selectedProductId,
            prompt: prompt,
            status: 'pending',
            requestedAt: serverTimestamp(),
        });
        toast({
            title: 'Request Submitted!',
            description: 'Your poster request has been sent to the admin for approval.'
        });
        setSelectedProductId(null);
        setPrompt('');
    } catch (error) {
        console.error("Error submitting poster request:", error);
        toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your request.' });
    } finally {
        setIsSubmitting(false);
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
              Request a unique, AI-generated promotional poster for your product. Requests will be reviewed by an admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Be descriptive! For example: 'A vibrant, cartoon-style poster showing the handbag on a sunny beach, with the text 'Summer Sale!' at the top. Use bright yellows and blues.'"
              />
            </div>
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>How it Works</AlertTitle>
                <AlertDescription>
                    Your request will be sent to an administrator for review. Once approved, our AI will generate the image, and it will be available in your product gallery. This process may take some time.
                </AlertDescription>
            </Alert>
            <Button
              onClick={handleSubmitRequest}
              disabled={isSubmitting || !selectedProductId || !prompt}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Submit Request (150 Points)
            </Button>
          </CardContent>
        </Card>
      </div>
    </SellerLayout>
  );
}
