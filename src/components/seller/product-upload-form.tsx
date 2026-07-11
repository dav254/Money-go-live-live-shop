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
  Video,
  Zap,
  AlertCircle,
  FileVideo,
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
  deliveryOptions: z.string().min(5, { message: 'Describe your delivery process.' }),
  wasPrice: z.coerce.number().optional().nullable(),
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
      stock: 1,
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
        wasPrice: productToEdit.wasPrice || null,
      });
    }
  }, [productToEdit, form]);

  const validateVideo = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'File Too Large', description: `Videos must be under ${MAX_FILE_SIZE_MB}MB.` });
            resolve(false);
            return;
        }

        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            if (video.duration > MAX_VIDEO_DURATION_SECONDS) {
                toast({ variant: 'destructive', title: 'Video Too Long', description: `Maximum duration is ${MAX_VIDEO_DURATION_SECONDS} seconds.` });
                resolve(false);
            } else {
                resolve(true);
            }
        };
        video.onerror = () => resolve(false);
        video.src = URL.createObjectURL(file);
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

  const handleVideoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedFiles = Array.from(files);
      const validatedFiles: File[] = [];
      
      for (const file of selectedFiles) {
          const isValid = await validateVideo(file);
          if (isValid) validatedFiles.push(file);
      }

      if (validatedFiles.length > 0) {
        setVideoFiles(prev => [...prev, ...validatedFiles]);
        const newPreviews = validatedFiles.map(f => URL.createObjectURL(f));
        setVideoPreviews(prev => [...prev, ...newPreviews]);
      }
    }
  };

  const removeVideo = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingVideoUrls(prev => prev.filter((_, i) => i !== index));
    } else {
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

      const productData = {
        ...values,
        imageUrl: finalImageUrls[0] || '',
        imageUrls: finalImageUrls,
        videoUrl: finalVideoUrls[0] || '',
        videoUrls: finalVideoUrls,
        hasVideo: finalVideoUrls.length > 0,
        status: 'active',
        updatedAt: serverTimestamp(),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData);
        toast({ title: 'SYNC SUCCESSFUL', description: 'Inventory node updated.' });
      } else {
        await addDoc(collection(firestore, 'products'), {
          ...productData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          inCartCount: 0,
          salesCount: 0
        });
        toast({ title: 'SIGNAL PUBLISHED', description: 'Merchant asset is now live.' });
      }
      onFormSubmit?.();
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Pipeline Error', description: 'Media synchronization failed.' });
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  }

  const onInvalid = () => {
    toast({
        variant: 'destructive',
        title: 'PROTOCOL HALTED',
        description: 'Please check for missing required fields (Name, Category, and Valuation).'
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
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
                    <span className="text-[8px] font-bold text-primary uppercase">Parallel Sync Active</span>
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
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Merchant Videos</Label>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10 text-neutral-500">Max 60s</Badge>
                        <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10 text-neutral-500">Max 50MB</Badge>
                    </div>
                  </div>
                  <Input type="file" accept="video/*" multiple onChange={handleVideoChange} className="bg-black/40 border-white/10 h-12 rounded-xl" />
                  
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
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">ASSET IDENTIFICATION</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-neutral-500">Asset Title</FormLabel>
                    <FormControl><Input placeholder="E.g. Urban Tech Streetwear" className="bg-black/40 border-white/10 h-12 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-6">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-neutral-500">Sector</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-neutral-500">Item Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-black/40 border-white/10 h-12 rounded-xl"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem></SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase text-neutral-500">Marketing Signal</FormLabel>
                    <FormControl><Textarea rows={6} className="bg-black/40 border-white/10 rounded-2xl resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
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
                    <FormItem>
                        <FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="bg-black/40 border-white/5 h-10 rounded-lg"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>)}</SelectContent>
                        </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Local Price</FormLabel><FormControl><Input type="number" className="bg-black/40 border-white/5 h-10 rounded-lg" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold text-primary uppercase tracking-widest">Protocol Valuation (USD)</FormLabel>
                    <FormControl><Input type="number" className="bg-black/40 border-primary/20 h-14 font-black text-xl rounded-xl text-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Node Inventory</FormLabel><FormControl><Input type="number" className="bg-black/40 border-white/10 h-12 font-black rounded-xl" {...field} /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="space-y-4">
                <Button type="submit" className="w-full h-20 rounded-[2.5rem] font-black uppercase text-lg shadow-2xl group relative overflow-hidden bg-primary hover:bg-primary/90 text-white border-none" disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <Zap className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />}
                    {productToEdit ? 'SYNC CHANGES' : 'PUBLISH SIGNAL'}
                </Button>
            </div>
          </div>
        </div>
      </form>
      {isUploading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-white animate-in fade-in duration-500">
            <div className="relative mb-8">
                <div className="absolute inset-[-20px] bg-primary/20 rounded-full animate-pulse blur-xl" />
                <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Syncing Media Pipeline</h3>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.3em] mt-3 text-center">Leveraging full network velocity</p>
        </div>
      )}
    </Form>
  );
}

const OpenTextarea = Textarea as any;
