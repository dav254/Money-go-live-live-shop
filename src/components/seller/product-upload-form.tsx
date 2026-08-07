'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import {
  UploadCloud,
  X,
  Loader2,
  ImageIcon,
  Video,
  Zap,
  ShieldCheck,
  Package,
  Truck,
  Layers,
  Tag,
} from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useUser, useFirebaseApp } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import type { ProductUploadFormProps } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const MAX_IMAGES = 5;
const MAX_FILE_SIZE_MB = 50;
const MAX_VIDEO_DURATION_SECONDS = 60;

const formSchema = z.object({
  name: z.string().min(2, { message: 'Product name is required.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  condition: z.enum(['new', 'used'], { required_error: 'Please select item condition.' }),
  localCurrency: z.string().default('KES'),
  localPrice: z.coerce.number().min(0, { message: 'Sale price must be 0 or higher.' }),
  price: z.coerce.number().min(0.01, { message: 'USD Protocol value must be greater than 0.' }),
  shippingCost: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0, { message: 'Stock cannot be negative.' }),
  description: z.string().min(10, { message: 'Please provide a detailed description (min 10 chars).' }),
  tags: z.string().optional(),
  deliveryOptions: z.string().min(5, { message: 'Describe your delivery process (min 5 chars).' }),
  wasPrice: z.coerce.number().optional().nullable(),
});

export function ProductUploadForm({ productToEdit, onFormSubmit }: ProductUploadFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const storage = getStorage(firebaseApp);
  const { toast } = useToast();

  const [imageFiles, setImageFiles] = useState<(File | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: 'Other',
      condition: 'new',
      localCurrency: 'KES',
      localPrice: 0,
      price: 0.01,
      shippingCost: 0,
      stock: 1,
      description: '',
      tags: '',
      deliveryOptions: 'Sent via local courier or pickup.',
      wasPrice: null,
    },
  });

  useEffect(() => {
    if (productToEdit) {
      const urls = productToEdit.imageUrls || (productToEdit.imageUrl ? [productToEdit.imageUrl] : []);
      const initialPreviews = new Array(MAX_IMAGES).fill(null);
      urls.forEach((url, i) => { if (i < MAX_IMAGES) initialPreviews[i] = url; });
      setImagePreviews(initialPreviews);
      setExistingVideoUrls(productToEdit.videoUrls || (productToEdit.videoUrl ? [productToEdit.videoUrl] : []));
      
      form.reset({
        name: productToEdit.name || '',
        category: productToEdit.category || 'Other',
        condition: productToEdit.condition || 'new',
        localCurrency: productToEdit.localCurrency || 'KES',
        localPrice: productToEdit.localPrice || 0,
        price: productToEdit.price || 0.01,
        shippingCost: productToEdit.shippingCost || 0,
        stock: productToEdit.stock || 0,
        description: productToEdit.description || '',
        tags: productToEdit.tags || '',
        deliveryOptions: productToEdit.deliveryOptions || 'Sent via local courier or pickup.',
        wasPrice: productToEdit.wasPrice || null,
      });
    }
  }, [productToEdit, form]);

  const uploadFile = (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Session Error', description: 'Please log in to publish products.' });
        return;
    }

    setIsUploading(true);

    try {
      const imageUploadPromises = imageFiles.map((file, i) => {
          if (file) {
              const path = `products/${user.uid}/${Date.now()}_img_${i}_${file.name}`;
              return uploadFile(file, path);
          }
          if (imagePreviews[i] && !imagePreviews[i]?.startsWith('blob:')) {
              return Promise.resolve(imagePreviews[i]!);
          }
          return Promise.resolve(null);
      });

      const videoUploadPromises = videoFiles.map((file, i) => {
          const path = `products/${user.uid}/${Date.now()}_vid_${i}_${file.name}`;
          return uploadFile(file, path);
      });

      const uploadedImages = await Promise.all(imageUploadPromises);
      const uploadedVideos = await Promise.all(videoUploadPromises);

      const finalImageUrls = uploadedImages.filter((url): url is string => !!url);
      const finalVideoUrls = [...existingVideoUrls, ...uploadedVideos];

      const productDataForDb = {
        name: values.name,
        category: values.category,
        condition: values.condition,
        description: values.description,
        price: values.price,
        localPrice: values.localPrice,
        localCurrency: values.localCurrency,
        stock: values.stock,
        shippingCost: values.shippingCost,
        deliveryOptions: values.deliveryOptions,
        tags: values.tags || '',
        wasPrice: values.wasPrice || null,
        imageUrl: finalImageUrls[0] || '',
        imageUrls: finalImageUrls,
        videoUrl: finalVideoUrls[0] || '',
        videoUrls: finalVideoUrls,
        hasVideo: finalVideoUrls.length > 0,
        updatedAt: serverTimestamp(),
      };

      if (productToEdit) {
        const productRef = doc(firestore, 'products', productToEdit.id);
        await updateDoc(productRef, productDataForDb);
        toast({ title: 'SYNC SUCCESSFUL', description: 'Inventory node updated.' });
      } else {
        const productsCol = collection(firestore, 'products');
        await addDoc(productsCol, {
          ...productDataForDb,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          salesCount: 0,
          rating: 0,
          brand: '',
        });
        toast({ title: 'SIGNAL PUBLISHED', description: 'Asset is now live.' });
      }
      onFormSubmit?.();
    } catch (error: any) {
      console.error("Firebase error details:", error);
      toast({ 
        variant: 'destructive', 
        title: 'Pipeline Error', 
        description: `Submission failed: ${error.message}. Check console for details.`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const onInvalid = (errors: any) => {
    const errorFields = Object.keys(errors).map(field => field.charAt(0).toUpperCase() + field.slice(1)).join(', ');
    toast({
        variant: 'destructive',
        title: 'VALIDATION FAILED',
        description: `Please correct the following fields: ${errorFields}.`
    });
  };

  const handleImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          toast({ variant: 'destructive', title: 'Image Too Large', description: 'Images must be under 5MB.' });
          return;
      }
      const newFiles = [...imageFiles];
      newFiles[index] = file;
      setImageFiles(newFiles);
      const objectUrl = URL.createObjectURL(file);
      const newPreviews = [...imagePreviews];
      newPreviews[index] = objectUrl;
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);
    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          <div className="lg:col-span-2 space-y-8">
            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <UploadCloud className="text-primary h-5 w-5" /> MEDIA PIPELINE
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Product Images (Max 5)</Label>
                  <div className="grid grid-cols-5 gap-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-black/40 group hover:border-primary/40 transition-all">
                        {preview ? (
                          <>
                            <Image src={preview} alt="preview" fill className="object-cover" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg z-10 opacity-0 group-hover:opacity-100" onClick={() => removeImage(i)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <button type="button" className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-white transition-colors" onClick={() => imageInputRefs.current[i]?.click()}><ImageIcon className="h-5 w-5" /></button>
                        )}
                        <input type="file" className="hidden" ref={el => { imageInputRefs.current[i] = el; }} accept="image/*" onChange={(e) => handleImageChange(i, e)} />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Title</FormLabel>
                    <FormControl><Input placeholder="e.g., Urban Tech Streetwear" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-6">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem></SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea rows={6} className="resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="tags" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., techwear, summer, waterproof" {...field} /></FormControl>
                    <FormDescription>Separate with commas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" /> LOGISTICS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Stock</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )} />
                    <FormField control={form.control} name="shippingCost" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Shipping (USD)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Info</FormLabel>
                    <FormControl><Input placeholder="e.g., Dispatched within 24h" {...field} /></FormControl>
                    <FormDescription>How you get the product to the buyer.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader>
                <CardTitle className="text-primary">PRICING</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="localCurrency" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem><FormLabel>Local Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valuation (USD)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="wasPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Price (USD)</FormLabel>
                    <FormControl><Input type="number" step="0.01" value={field.value ?? ''} onChange={field.onChange} placeholder="e.g., 1000.00" /></FormControl>
                    <FormDescription>Optional, for showing discounts.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-16 rounded-xl font-bold text-lg" disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Zap className="mr-2 h-6 w-6" />}
                {productToEdit ? 'Update Product' : 'Publish Product'}
            </Button>

            <div className="p-3 rounded-lg bg-neutral-900 border border-white/10 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-xs text-neutral-400">
                    All updates are securely synchronized with the network.
                </p>
            </div>
          </div>
        </div>
      </form>
      
      {isUploading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h3 className="text-xl font-bold">Syncing...</h3>
            <p className="text-sm text-neutral-400">Please wait while we update the product.</p>
        </div>
      )}
    </Form>
  );
}
