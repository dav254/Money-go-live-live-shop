'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
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
  CheckCircle2,
  Tag as TagIcon,
  Percent,
  Truck,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useUser, useFirebaseApp } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

const MAX_IMAGES = 5;

const formSchema = z.object({
  name: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  brand: z.string().optional(),
  category: z.string().min(1, { message: 'Please select a category.' }),
  condition: z.enum(['new', 'used'], { required_error: 'Please select item condition.' }),
  localCurrency: z.string().default('KES'),
  localPrice: z.coerce.number().min(0, { message: 'Local price must be a positive number.' }),
  price: z.coerce.number().min(0, { message: 'USD Price must be a positive number.' }),
  shippingCost: z.coerce.number().min(0, { message: 'Shipping cost must be a non-negative number.' }).default(0),
  stock: z.coerce.number().int().min(0, { message: 'Stock must be a non-negative integer.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  tags: z.string().optional(),
  deliveryOptions: z.string().min(5, { message: 'Please describe delivery options.' }),
  wasPrice: z.coerce.number().optional(),
});

interface ProductUploadFormProps {
  productToEdit?: Product;
  onFormSubmit?: () => void;
}

export function ProductUploadForm({ productToEdit, onFormSubmit }: ProductUploadFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const storage = getStorage(firebaseApp);
  const { toast } = useToast();

  // Local files state (Files or null)
  const [imageFiles, setImageFiles] = useState<(File | null)[]>(new Array(MAX_IMAGES).fill(null));
  // Previews state (Cloud URLs or Blob URLs)
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
      brand: '',
      category: 'Other',
      condition: 'new',
      localCurrency: 'KES',
      localPrice: 0,
      price: 0,
      shippingCost: 0,
      stock: 0,
      description: '',
      tags: '',
      deliveryOptions: '',
      wasPrice: undefined,
    },
  });

  // Handle initialization when editing
  useEffect(() => {
    if (productToEdit) {
      const urls = productToEdit.imageUrls || (productToEdit.imageUrl ? [productToEdit.imageUrl] : []);
      const initialPreviews = new Array(MAX_IMAGES).fill(null);
      urls.forEach((url, i) => { if (i < MAX_IMAGES) initialPreviews[i] = url; });
      setImagePreviews(initialPreviews);
      
      setExistingVideoUrls(productToEdit.videoUrls || (productToEdit.videoUrl ? [productToEdit.videoUrl] : []));
      
      form.reset({
        name: productToEdit.name || '',
        brand: productToEdit.brand || '',
        category: productToEdit.category || 'Other',
        condition: productToEdit.condition || 'new',
        localCurrency: productToEdit.localCurrency || 'KES',
        localPrice: productToEdit.localPrice || 0,
        price: productToEdit.price || 0,
        shippingCost: productToEdit.shippingCost || 0,
        stock: productToEdit.stock || 0,
        description: productToEdit.description || '',
        tags: productToEdit.tags || '',
        deliveryOptions: productToEdit.deliveryOptions || '',
        wasPrice: productToEdit.wasPrice || undefined,
      });
    }
  }, [productToEdit, form]);

  const handleImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 1. Update files array
      const newFiles = [...imageFiles];
      newFiles[index] = file;
      setImageFiles(newFiles);

      // 2. Create preview and update previews array
      const objectUrl = URL.createObjectURL(file);
      const newPreviews = [...imagePreviews];
      // Cleanup old blob if it exists
      if (newPreviews[index]?.startsWith('blob:')) {
        URL.revokeObjectURL(newPreviews[index]!);
      }
      newPreviews[index] = objectUrl;
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    // 1. Cleanup preview if it's a blob
    if (imagePreviews[index]?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviews[index]!);
    }

    // 2. Reset arrays
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);

    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
  };

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      setVideoFiles(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(f => URL.createObjectURL(f));
      setVideoPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeVideo = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingVideoUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      URL.revokeObjectURL(videoPreviews[index]);
      setVideoFiles(prev => prev.filter((_, i) => i !== index));
      setVideoPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

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

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsUploading(true);

    try {
      // 1. Process Images: Combine existing cloud URLs with new uploads
      const finalImageUrls: string[] = [];
      for (let i = 0; i < MAX_IMAGES; i++) {
        const preview = imagePreviews[i];
        const file = imageFiles[i];

        if (preview && !preview.startsWith('blob:')) {
          // It's an existing cloud URL
          finalImageUrls.push(preview);
        } else if (file instanceof File) {
          // It's a new file that needs uploading
          const path = `products/${user.uid}/${Date.now()}_img_${i}_${file.name}`;
          const url = await uploadFile(file, path);
          finalImageUrls.push(url);
        }
      }

      // 2. Process Videos: Combine existing with new uploads
      const finalVideoUrls: string[] = [...existingVideoUrls];
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const path = `products/${user.uid}/${Date.now()}_vid_${i}_${file.name}`;
        const url = await uploadFile(file, path);
        finalVideoUrls.push(url);
      }

      const productData = {
        ...values,
        wasPrice: values.wasPrice && values.wasPrice > 0 ? values.wasPrice : null,
        imageUrl: finalImageUrls[0] || '',
        imageUrls: finalImageUrls,
        videoUrl: finalVideoUrls[0] || '',
        videoUrls: finalVideoUrls,
        hasVideo: finalVideoUrls.length > 0,
        updatedAt: serverTimestamp(),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData);
        toast({ title: 'Success', description: 'Product metadata updated.' });
      } else {
        await addDoc(collection(firestore, 'products'), {
          ...productData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          inCartCount: 0,
        });
        toast({ title: 'Live!', description: 'Your product is now discoverable.' });
      }

      onFormSubmit?.();
    } catch (error: any) {
      console.error("Upload Node Error:", error);
      toast({ 
          variant: 'destructive', 
          title: 'Signal Error', 
          description: error.message || 'Failed to process media assets.' 
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full max-w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {/* Media Section */}
            <Card className="rounded-[2rem] overflow-hidden border-white/5 bg-neutral-900/50 shadow-2xl">
              <CardHeader className="p-8 bg-white/5 border-b border-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <ImageIcon className="text-primary h-5 w-5" /> MEDIA ASSETS
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Upload images and videos (max 5 slots)</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Photos Gallery</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-black/40 group hover:border-primary/40 transition-all">
                        {preview ? (
                          <>
                            <Image src={preview} alt="preview" fill className="object-cover" />
                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full shadow-lg" 
                              onClick={() => removeImage(i)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <button 
                            type="button" 
                            className="w-full h-full flex flex-col items-center justify-center gap-1.5"
                            onClick={() => imageInputRefs.current[i]?.click()}
                          >
                            <UploadCloud className="h-5 w-5 text-neutral-700 group-hover:text-primary transition-colors" />
                            <span className="text-[8px] font-black text-neutral-700 uppercase">Slot {i+1}</span>
                          </button>
                        )}
                        <input 
                          type="file" 
                          className="hidden" 
                          ref={el => imageInputRefs.current[i] = el} 
                          accept="image/*" 
                          onChange={(e) => handleImageChange(i, e)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-white/5" />

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Short-Form Videos</Label>
                  <div className="flex flex-col gap-4">
                    <Input 
                        type="file" 
                        accept="video/*" 
                        multiple 
                        onChange={handleVideoChange} 
                        className="bg-black/40 border-white/10 h-12 rounded-xl text-xs pt-3" 
                    />
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {existingVideoUrls.map((url, i) => (
                        <div key={`ex-${i}`} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black group">
                          <video src={url} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Badge className="bg-primary text-white text-[8px] font-black">CLOUD</Badge>
                          </div>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full" 
                            onClick={() => removeVideo(i, true)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {videoFiles.map((file, i) => (
                        <div key={`new-${i}`} className="relative aspect-video rounded-2xl overflow-hidden border border-primary/20 bg-black group">
                          <video src={videoPreviews[i]} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">PENDING</span>
                            {uploadProgress[file.name] !== undefined && (
                                <Progress value={uploadProgress[file.name]} className="h-0.5 w-12 bg-white/10" />
                            )}
                          </div>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full" 
                            onClick={() => removeVideo(i, false)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Section */}
            <Card className="rounded-[2rem] overflow-hidden border-white/5 bg-neutral-900/50 shadow-2xl">
              <CardHeader className="p-8 bg-white/5 border-b border-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <TagIcon className="text-primary h-5 w-5" /> LISTING DETAILS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Product Designation</FormLabel>
                    <FormControl><Input placeholder="e.g. Vintage Leather Jacket" className="h-12 bg-black/40 border-white/10 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Inventory Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-12 bg-black/40 border-white/10 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                   <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Item Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-12 bg-black/40 border-white/10 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="new">Brand New</SelectItem>
                          <SelectItem value="used">Pre-Owned</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Marketing Bio</FormLabel>
                    <FormControl><Textarea rows={6} className="bg-black/40 border-white/10 rounded-2xl resize-none p-4" placeholder="Detail the features and benefits..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            {/* Financial Deck */}
            <Card className="rounded-[2rem] overflow-hidden border-white/5 bg-neutral-900/50 shadow-2xl">
              <CardHeader className="p-6 bg-white/5 border-b border-white/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">YIELD & PRICING</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="localCurrency" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-10 bg-black/40 border-white/5 rounded-lg text-xs"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Sale Price</FormLabel>
                      <FormControl><Input type="number" className="h-10 bg-black/40 border-white/5 rounded-lg text-xs font-black" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Global Equiv (USD)</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-black">$</span>
                            <Input type="number" className="h-12 bg-black/40 border-white/10 rounded-xl pl-8 font-black text-base" {...field} />
                        </div>
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="wasPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Market Price (USD)</FormLabel>
                      <FormControl><Input type="number" className="h-10 bg-black/40 border-white/5 rounded-lg text-xs text-neutral-500" {...field} value={field.value ?? ''} /></FormControl>
                      <FormDescription className="text-[8px] font-bold uppercase text-neutral-600">Triggers 'Sale' badge if higher than price.</FormDescription>
                    </FormItem>
                )} />

                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Units Available</FormLabel>
                    <FormControl><Input type="number" className="h-12 bg-black/40 border-white/10 rounded-xl font-black text-center" {...field} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Logistics Deck */}
            <Card className="rounded-[2rem] overflow-hidden border-white/5 bg-neutral-900/50 shadow-2xl">
              <CardHeader className="p-6 bg-white/5 border-b border-white/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">LOGISTICS</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <FormField control={form.control} name="shippingCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Delivery Fee (USD)</FormLabel>
                    <FormControl><Input type="number" className="h-10 bg-black/40 border-white/5 rounded-lg text-xs" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[9px] font-black uppercase text-neutral-500">Courier Info</FormLabel>
                    <FormControl><Textarea rows={2} className="bg-black/40 border-white/5 rounded-xl text-xs resize-none" placeholder="e.g. Same-day Nairobi via Boda" {...field} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Button 
                type="submit" 
                className="w-full h-20 rounded-[2rem] font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/30 group transition-all" 
                disabled={isUploading}
            >
              {isUploading ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <CheckCircle2 className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />}
              {productToEdit ? 'SAVE CHANGES' : 'PUBLISH SIGNAL'}
            </Button>
            
            <p className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.4em] text-center w-full">Verified merchant protocol active</p>
          </div>
        </div>
      </form>
    </Form>
  );
}
