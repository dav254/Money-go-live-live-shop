
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

const MAX_IMAGES = 5;

const formSchema = z.object({
  name: z.string().min(2, { message: 'Product name is required.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  condition: z.enum(['new', 'used'], { required_error: 'Please select item condition.' }),
  localCurrency: z.string().default('KES'),
  localPrice: z.coerce.number().min(0),
  price: z.coerce.number().min(0, { message: 'USD Price is required for global node sync.' }),
  shippingCost: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0),
  description: z.string().min(10, { message: 'Please provide a detailed description.' }),
  tags: z.string().optional(),
  deliveryOptions: z.string().min(5, { message: 'Describe your delivery process.' }),
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
      price: 0,
      shippingCost: 0,
      stock: 0,
      description: '',
      tags: '',
      deliveryOptions: '',
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

  // Clean up blob URLs to prevent memory leaks and crashes
  useEffect(() => {
    return () => {
        imagePreviews.forEach(p => { if (p?.startsWith('blob:')) URL.revokeObjectURL(p); });
        videoPreviews.forEach(p => { if (p?.startsWith('blob:')) URL.revokeObjectURL(p); });
    };
  }, []);

  const handleImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newFiles = [...imageFiles];
      newFiles[index] = file;
      setImageFiles(newFiles);
      
      const objectUrl = URL.createObjectURL(file);
      const newPreviews = [...imagePreviews];
      if (newPreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(newPreviews[index]!);
      newPreviews[index] = objectUrl;
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    if (imagePreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(imagePreviews[index]!);
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
      if (videoPreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(videoPreviews[index]);
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
        (error) => {
            console.error("Upload error:", error);
            reject(error);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Unauthorized', description: 'Please sign in to upload products.' });
        return;
    }

    setIsUploading(true);
    setUploadProgress({});

    try {
      const finalImageUrls: string[] = [];
      // Sequential upload to prevent browser memory exhaustion
      for (let i = 0; i < MAX_IMAGES; i++) {
        const preview = imagePreviews[i];
        const file = imageFiles[i];
        if (preview && !preview.startsWith('blob:')) {
          finalImageUrls.push(preview);
        } else if (file instanceof File) {
          const path = `products/${user.uid}/${Date.now()}_img_${i}_${file.name}`;
          const url = await uploadFile(file, path);
          finalImageUrls.push(url);
        }
      }

      const finalVideoUrls: string[] = [...existingVideoUrls];
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const path = `products/${user.uid}/${Date.now()}_vid_${i}_${file.name}`;
        const url = await uploadFile(file, path);
        finalVideoUrls.push(url);
      }

      const productData: any = {
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
        toast({ title: 'SIGNAL UPDATED', description: 'Changes have been synchronized with the global node.' });
      } else {
        await addDoc(collection(firestore, 'products'), {
          ...productData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          inCartCount: 0,
        });
        toast({ title: 'SIGNAL PUBLISHED', description: 'Your item is now live in the global discovery feed.' });
      }
      onFormSubmit?.();
    } catch (error: any) {
      console.error("Submission crash:", error);
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'The data bus was interrupted. Please check your network and try again.' });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="rounded-[2rem] border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
              <CardHeader className="p-8 border-b border-white/5 bg-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <UploadCloud className="text-primary h-5 w-5" /> MEDIA PIPELINE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Imagery (Max 5)</Label>
                    <span className="text-[8px] font-bold text-primary uppercase">Primary at Slot 1</span>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-black/40 group hover:border-primary/40 transition-all">
                        {preview ? (
                          <>
                            <Image src={preview} alt="preview" fill className="object-cover" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg z-10" onClick={() => removeImage(i)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <button type="button" className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-20 hover:opacity-100 transition-opacity" onClick={() => imageInputRefs.current[i]?.click()}><ImageIcon className="h-5 w-5" /></button>
                        )}
                        <input type="file" className="hidden" ref={el => { imageInputRefs.current[i] = el; }} accept="image/*" onChange={(e) => handleImageChange(i, e)} />
                      </div>
                    ))}
                  </div>
                </div>
                <Separator className="bg-white/5" />
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Product Videos (Vertical Preferred)</Label>
                  <div className="flex gap-4 items-center">
                    <Input type="file" accept="video/*" multiple onChange={handleVideoChange} className="bg-black/40 border-white/10 h-12 rounded-xl flex-1" />
                  </div>
                  
                  {(videoFiles.length > 0 || existingVideoUrls.length > 0) && (
                    <div className="grid grid-cols-3 gap-4">
                        {existingVideoUrls.map((url, i) => (
                        <div key={`ex-${i}`} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black">
                            <video src={url} className="w-full h-full object-cover" muted />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg" onClick={() => removeVideo(i, true)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                        ))}
                        {videoFiles.map((file, i) => (
                        <div key={`new-${i}`} className="relative aspect-video rounded-2xl overflow-hidden border border-primary/20 bg-black">
                            <video src={videoPreviews[i]} className="w-full h-full object-cover" muted />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="text-[8px] font-black text-white uppercase">{Math.round(uploadProgress[file.name] || 0)}%</span>
                            </div>
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg" onClick={() => removeVideo(i, false)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                        ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-white/5 bg-neutral-900/50">
              <CardHeader className="p-8 border-b border-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">IDENTIFICATION</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase text-neutral-500">Asset Designation</FormLabel><FormControl><Input placeholder="E.g. Urban Tech Streetwear V1" className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-6">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-neutral-500">Sector</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl><SelectContent>{PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></FormItem>
                  )} />
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase text-neutral-500">Asset State</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="new">Brand New</SelectItem><SelectItem value="used">Pre-Owned</SelectItem></SelectContent></Select></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-black uppercase text-neutral-500">Marketing Signal</FormLabel><FormControl><Textarea rows={6} className="bg-black/40 border-white/10 rounded-2xl resize-none" placeholder="Elaborate on the value proposition..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="rounded-[2rem] border-white/5 bg-neutral-900/50 overflow-hidden shadow-2xl">
              <CardHeader className="p-6 border-b border-white/5 bg-white/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">VALUATION GRID</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="localCurrency" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Unit</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="bg-black/40 border-white/5 h-10 rounded-lg"><SelectValue /></SelectTrigger></FormControl><SelectContent>{SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>)}</SelectContent></Select></FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Sale Price</FormLabel><FormControl><Input type="number" className="bg-black/40 border-white/5 h-10 rounded-lg" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold text-primary uppercase tracking-widest">Protocol Value (USD)</FormLabel><FormControl><Input type="number" className="bg-black/40 border-primary/20 h-14 font-black text-xl rounded-xl text-primary" {...field} /></FormControl><FormDescription className="text-[8px] uppercase font-bold text-neutral-600">Locked value for global settlement</FormDescription></FormItem>
                )} />
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Node Inventory (Units)</FormLabel><FormControl><Input type="number" className="bg-black/40 border-white/10 h-12 font-black rounded-xl" {...field} /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="space-y-4">
                <Button type="submit" className="w-full h-20 rounded-[2.5rem] font-black uppercase text-lg shadow-2xl group relative overflow-hidden" disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <CheckCircle2 className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />}
                    {productToEdit ? 'SYNC CHANGES' : 'PUBLISH SIGNAL'}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 overflow-hidden">
                        {isUploading && <div className="h-full bg-white animate-[loading-scan_1.5s_infinite_linear]" />}
                    </div>
                </Button>
                {productToEdit && (
                    <Button type="button" variant="ghost" className="w-full h-12 font-black uppercase text-[10px] tracking-widest text-neutral-500" onClick={onFormSubmit}>
                        Abort Sequence
                    </Button>
                )}
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
