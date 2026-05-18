
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { 
  Megaphone, 
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
});

export default function PostRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please log in to broadcast a need.',
      });
      return;
    }

    setIsSubmitting(true);
    
    // Aligned to "One by One" build: Currently only Title and Metadata
    const requestData = {
        buyerId: user.uid,
        title: values.title,
        status: 'open',
        offersCount: 0,
        createdAt: serverTimestamp(),
    };

    const requestsRef = collection(firestore, 'requests');
    
    addDoc(requestsRef, requestData)
      .then(() => {
          toast({
            title: "Broadcast Live! 🚀",
            description: "Your requirement has been sent to the marketplace.",
          });
          setIsSubmitting(false);
          router.push('/buyer/requests/my-requests');
      })
      .catch(async (error) => {
          console.error("Submission error:", error);
          const permissionError = new FirestorePermissionError({
              path: 'requests',
              operation: 'create',
              requestResourceData: requestData,
          });
          errorEmitter.emit('permission-error', permissionError);
          setIsSubmitting(false);
      });
  }

  return (
    <BuyerLayout>
      <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 mb-12">
            <div className="p-3 bg-primary/10 rounded-2xl">
                <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white leading-none">Broadcast</h1>
                <p className="text-muted-foreground font-medium text-[10px] uppercase tracking-widest mt-1">Starting with Title only</p>
            </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card className="bg-neutral-900/50 border-white/5 shadow-2xl rounded-[2.5rem]">
              <CardHeader className="p-8">
                <CardTitle className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Requirement
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Enter what you are looking for</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 space-y-8">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-500 ml-1">Requirement Title</FormLabel>
                    <FormControl><Input placeholder="e.g. Need a high-end designer laptop" className="h-14 bg-black/40 border-white/10 text-white rounded-2xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <Button type="submit" className="w-full h-16 font-black uppercase tracking-widest text-sm bg-primary hover:bg-primary/90 text-white shadow-2xl rounded-2xl border-none" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Megaphone className="mr-2 h-4 w-4" />}
                    BROADCAST NOW
                </Button>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </BuyerLayout>
  );
}
