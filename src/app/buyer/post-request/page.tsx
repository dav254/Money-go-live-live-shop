'use client';

import React, { useState, useRef } from 'react';
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
  CardFooter,
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  X, 
  Video, 
  Image as ImageIcon, 
  Loader2, 
  Megaphone, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  DollarSign,
  Tag
} from 'lucide-react';
import { kenyaLocations } from '@/lib/location-data';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(10, "Please provide more details about what you need."),
  category: z.string().min(1, "Please select a category."),
  subcategory: z.string().optional(),
  minBudget: z.coerce.number().min(1, "Minimum budget must be at least 1 KES."),
  maxBudget: z.coerce.number().min(1, "Maximum budget must be at least 1 KES."),
  currency: z.string().default('KES'),
  country: z.string().default('Kenya'),
  county: z.string().min(1, "Please select your county."),
  area: z.string().min(2, "Please enter your town or area."),
  contactMethod: z.enum(['chat', 'whatsapp', 'phone']),
  deadline: z.enum(['urgent', '3-days', 'flexible']),
});

export default function PostRequestPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();
  const router = useRouter();

  const [isUploading, setIsUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      minBudget: 1000,
      maxBudget: 2500,
      currency: 'KES',
      country: 'Kenya',
      county: '',
      area: '',
      contactMethod: 'chat',
      deadline: 'flexible',
    },
  });

  const uploadFile = (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please sign in to post a request.' });
      return;
    }
    setIsUploading(true);

    try {
      let videoUrl = null;
      let imageUrls: string[] = [];

      if (videoFile) {
        const path = `requests/${user.uid}/${Date.now()}_video.mp4`;
        videoUrl = await uploadFile(videoFile, path);
      }

      if (imageFile) {
        const path = `requests/${user.uid}/${Date.now()}_image.png`;
        const url = await uploadFile(imageFile, path);
        imageUrls.push(url);
      }

      const requestData = {
        ...values,
        buyerId: user.uid,
        status: 'open',
        videoUrl,
        imageUrls,
        offersCount: 0,
        selectedSellerId: null,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'requests'), requestData);
      
      toast({ title: 'Broadcast Published!', description: 'Sellers will be notified and can now send you offers.' });
      router.push('/buyer/requests/my-requests');
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Broadcast Failed', description: error.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <BuyerLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-2xl">
                <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="font-headline text-3xl font-black uppercase tracking-tighter">Broadcast Your Need</h1>
                <p className="text-muted-foreground font-medium">Tell sellers exactly what you want and let them compete for you.</p>
            </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-2 space-y-8">
                <Card className="bg-neutral-900 border-white/5 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">1. Basic Information</CardTitle>
                    <CardDescription>What product or service are you looking for?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest">Request Title</FormLabel>
                        <FormControl><Input placeholder="e.g. Need a plumber in Nairobi West" className="h-12 bg-white/5 border-white/10" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-black text-[10px] uppercase tracking-widest">Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-12 bg-white/5 border-white/10"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="deadline" render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-black text-[10px] uppercase tracking-widest">Deadline</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-12 bg-white/5 border-white/10"><SelectValue placeholder="Priority" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="urgent">Urgent (Today)</SelectItem>
                                    <SelectItem value="3-days">Within 3 Days</SelectItem>
                                    <SelectItem value="flexible">Flexible</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest">Full Description</FormLabel>
                        <FormControl><Textarea rows={6} className="bg-white/5 border-white/10" placeholder="e.g. Kitchen sink is leaking and needs urgent repair. Please provide a quote including materials." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-white/5 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">2. Visual Proof (Highly Recommended)</CardTitle>
                    <CardDescription>Sellers respond 5x faster to requests with video or images.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Label className="font-black text-[10px] uppercase tracking-widest">Photo Proof</Label>
                        <div className="relative aspect-video rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center overflow-hidden group">
                            {imageFile ? (
                                <>
                                    <Image src={URL.createObjectURL(imageFile)} alt="Preview" fill className="object-cover" />
                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => setImageFile(null)}><X className="h-4 w-4"/></Button>
                                </>
                            ) : (
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-neutral-500 hover:text-white transition-colors">
                                    <ImageIcon className="h-8 w-8" />
                                    <span className="text-[10px] font-black uppercase">Add Photo</span>
                                </button>
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>

                    <div className="space-y-4">
                         <Label className="font-black text-[10px] uppercase tracking-widest">Video Request (Max 30s)</Label>
                         <div className="relative aspect-video rounded-2xl border-2 border-dashed border-white/10 bg-white/5 flex items-center justify-center overflow-hidden group">
                            {videoFile ? (
                                <>
                                    <video src={URL.createObjectURL(videoFile)} className="h-full w-full object-cover" controls />
                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => setVideoFile(null)}><X className="h-4 w-4"/></Button>
                                </>
                            ) : (
                                <button type="button" onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center gap-2 text-neutral-500 hover:text-white transition-colors">
                                    <Video className="h-8 w-8" />
                                    <span className="text-[10px] font-black uppercase">Record / Add Video</span>
                                </button>
                            )}
                            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="bg-neutral-900 border-white/5 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">3. Budget & Location</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="minBudget" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-black text-[10px] uppercase tracking-widest">Min (KES)</FormLabel>
                                <FormControl><Input type="number" className="h-12 bg-white/5 border-white/10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="maxBudget" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-black text-[10px] uppercase tracking-widest">Max (KES)</FormLabel>
                                <FormControl><Input type="number" className="h-12 bg-white/5 border-white/10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="county" render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest">County</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-white/5 border-white/10"><SelectValue placeholder="Select County" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {Object.keys(kenyaLocations).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="area" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest">Town / Area</FormLabel>
                        <FormControl><Input placeholder="e.g. Westlands" className="h-12 bg-white/5 border-white/10" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="contactMethod" render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest">Contact Preference</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-white/5 border-white/10"><SelectValue placeholder="Select Mode" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="chat">In-App Chat</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="phone">Phone Call</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <div className="space-y-4">
                     {isUploading && (
                        <div className="space-y-2">
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                 <span>Broadcasting Payload...</span>
                                 <span>{Math.round(uploadProgress)}%</span>
                             </div>
                             <Progress value={uploadProgress} className="h-1 bg-white/10" />
                        </div>
                     )}
                    <Button type="submit" className="w-full h-16 font-black uppercase tracking-widest text-lg shadow-xl shadow-primary/20" disabled={isUploading}>
                    {isUploading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                    PUBLISH BROADCAST
                    </Button>
                    <p className="text-[9px] font-black text-center text-neutral-500 uppercase tracking-widest">By publishing, you agree to our marketplace terms.</p>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </BuyerLayout>
  );
}