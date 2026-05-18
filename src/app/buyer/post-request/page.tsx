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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { 
  Megaphone, 
  Keyboard, 
  Video, 
  Loader2,
  MapPin,
} from 'lucide-react';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(10, "Please provide more details about what you need."),
  category: z.string().min(1, "Please select a category."),
  minBudget: z.coerce.number().min(0, "Budget must be a positive number"),
  maxBudget: z.coerce.number().min(0, "Budget must be a positive number"),
  county: z.string().min(1, "Please enter your county."),
  area: z.string().min(1, "Please enter your specific area."),
});

export default function PostRequestPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [requestMode, setRequestMode] = useState<'text' | 'video'>('text');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      minBudget: 0,
      maxBudget: 0,
      county: '',
      area: '',
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
    
    const requestData = {
        buyerId: user.uid,
        title: values.title,
        description: values.description,
        category: values.category,
        minBudget: values.minBudget,
        maxBudget: values.maxBudget,
        county: values.county,
        area: values.area,
        status: 'open',
        requestType: requestMode,
        offersCount: 0,
        createdAt: serverTimestamp(),
    };

    const requestsRef = collection(firestore, 'requests');
    
    // Non-blocking Firestore write
    addDoc(requestsRef, requestData)
      .catch(async (error) => {
          const permissionError = new FirestorePermissionError({
              path: 'requests',
              operation: 'create',
              requestResourceData: requestData,
          });
          errorEmitter.emit('permission-error', permissionError);
      });

    toast({
      title: "Broadcast Live! 🚀",
      description: "Your requirement has been sent to all local sellers in " + values.area,
    });
    
    setTimeout(() => {
        setIsSubmitting(false);
        router.push('/buyer/requests/my-requests');
    }, 1000);
  }

  return (
    <BuyerLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                    <Megaphone className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">Broadcast a Need</h1>
                    <p className="text-muted-foreground font-medium text-xs uppercase tracking-widest mt-1">Sellers will compete to give you the best deal</p>
                </div>
            </div>
            
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-white/5 shadow-2xl">
                <button 
                    type="button" 
                    onClick={() => setRequestMode('text')}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", requestMode === 'text' ? "bg-primary text-white" : "text-muted-foreground hover:text-white")}
                >
                    <Keyboard className="h-4 w-4" /> Text
                </button>
                <button 
                    type="button" 
                    onClick={() => setRequestMode('video')}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all", requestMode === 'video' ? "bg-primary text-white" : "text-muted-foreground hover:text-white")}
                >
                    <Video className="h-4 w-4" /> Video
                </button>
            </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Card className="bg-neutral-900/50 border-white/5 shadow-2xl rounded-[2.5rem]">
                  <CardHeader className="p-8">
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">Need Details</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Provide context for the sellers</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-8">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Requirement Summary</FormLabel>
                        <FormControl><Input placeholder="e.g. Office Laptop for Designer" className="h-14 bg-black/40 border-white/10 text-white rounded-2xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-14 bg-black/40 border-white/10 text-white rounded-2xl">
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="county" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-500">County</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Nairobi" className="h-14 bg-black/40 border-white/10 text-white rounded-2xl" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="area" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Specific Area / Town</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Westlands, CBD, Ruiru" className="h-14 bg-black/40 border-white/10 text-white rounded-2xl" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-500">Details & Service</FormLabel>
                        <FormControl><Textarea rows={6} className="bg-black/40 border-white/10 text-white rounded-2xl" placeholder="Tell sellers exactly what you want..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="bg-neutral-950 border-white/5 shadow-2xl rounded-[2.5rem]">
                  <CardHeader className="p-8">
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">Budget Range</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <div className="space-y-4">
                        <FormField control={form.control} name="minBudget" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-neutral-500">Min Budget</FormLabel>
                                <FormControl><Input type="number" className="h-14 bg-black/40 border-white/10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="maxBudget" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase text-neutral-500">Max Budget</FormLabel>
                                <FormControl><Input type="number" className="h-14 bg-black/40 border-white/10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                  </CardContent>
                </Card>

                <Button type="submit" className="w-full h-20 font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/30 rounded-[2rem] border-none" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Megaphone className="mr-2" />}
                    BROADCAST NOW
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </BuyerLayout>
  );
}
