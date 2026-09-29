
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
<<<<<<< HEAD
  Zap,
  ShieldCheck,
  Truck,
=======
  CheckCircle2,
  Video,
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
  BadgeCent,
} from 'lucide-react';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import type { ProductUploadFormProps } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const MAX_IMAGES = 5;

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
  const { toast } = useToast();

  const [imageFiles, setImageFiles] = useState<(File | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: 'Other',
      condition: 'new',
      localCurrency: 'KES',
      localPrice: 0,
      price: 1.00,
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
      
      form.reset({
        name: productToEdit.name || '',
        category: productToEdit.category || 'Other',
        condition: productToEdit.condition || 'new',
        localCurrency: productToEdit.localCurrency || 'KES',
        localPrice: productToEdit.localPrice || 0,
        price: productToEdit.price || 1.00,
        shippingCost: productToEdit.shippingCost || 0,
        stock: productToEdit.stock || 0,
        description: productToEdit.description || '',
        tags: productToEdit.tags || '',
        deliveryOptions: productToEdit.deliveryOptions || 'Sent via local courier or pickup.',
        wasPrice: productToEdit.wasPrice || null,
      });
    }
  }, [productToEdit, form]);

<<<<<<< HEAD
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
=======
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

  /**
   * Uploads a file to Cloudinary using a signed request from the server.
   */
  const uploadToCloudinary = async (file: File): Promise<string> => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
        timestamp,
        folder: `products/${user?.uid}`,
    };

    // 1. Get secure signature from local API node
    const sigRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
    });
    const { signature } = await sigRes.json();

    // 2. Prepare multipart upload data
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!);
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('signature', signature);
    uploadFormData.append('folder', `products/${user?.uid}`);

    const resourceType = file.type.startsWith('video') ? 'video' : 'image';
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    // 3. Post directly to Cloudinary edge node
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: uploadFormData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Cloudinary handshaking failed.');
    
    return data.secure_url;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
<<<<<<< HEAD
        toast({ variant: 'destructive', title: 'Session Error' });
=======
        toast({ variant: 'destructive', title: 'Session Expired', description: 'Please sign in to continue.' });
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
        return;
    }

    setIsUploading(true);
    try {
<<<<<<< HEAD
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

      const uploadedImages = await Promise.all(imageUploadPromises);
      const finalImageUrls = uploadedImages.filter((url): url is string => !!url);
=======
      // Process images sequentially for stability
      const finalImageUrls: string[] = [];
      for (let i = 0; i < MAX_IMAGES; i++) {
        const preview = imagePreviews[i];
        const file = imageFiles[i];
        if (preview && !preview.startsWith('blob:')) {
          finalImageUrls.push(preview);
        } else if (file instanceof File) {
          const url = await uploadToCloudinary(file);
          finalImageUrls.push(url);
        }
      }

      // Process videos sequentially
      const finalVideoUrls: string[] = [...existingVideoUrls];
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const url = await uploadToCloudinary(file);
        finalVideoUrls.push(url);
      }
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7

      const productData = {
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
        updatedAt: serverTimestamp(),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData);
<<<<<<< HEAD
        toast({ title: 'SYNC SUCCESSFUL', description: 'Inventory node updated.' });
=======
        toast({ title: 'INVENTORY SYNCED', description: 'Changes have been pushed to Cloudinary nodes.' });
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
      } else {
        await addDoc(collection(firestore, 'products'), {
          ...productData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
<<<<<<< HEAD
          salesCount: 0,
        });
        toast({ title: 'SIGNAL PUBLISHED', description: 'Asset is now live on Vidnov.' });
      }
      onFormSubmit?.();
    } catch (error: any) {
      const msg = error.code === 'storage/quota-exceeded' 
        ? "Storage quota exceeded. Please upgrade to the Blaze plan in Firebase Console." 
        : error.message;
      toast({ variant: 'destructive', title: 'Pipeline Error', description: msg });
=======
          inCartCount: 0,
          salesCount: 0
        });
        toast({ title: 'SIGNAL PUBLISHED', description: 'Asset is now active in global discovery.' });
      }
      onFormSubmit?.();
    } catch (error: any) {
      console.error("Cloudinary Pipeline Crash:", error);
      toast({ variant: 'destructive', title: 'PROTOCOL ERROR', description: error.message || 'The data bus was interrupted during upload.' });
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
    } finally {
      setIsUploading(false);
    }
  };

<<<<<<< HEAD
  const handleImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
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
=======
  const onInvalid = (errors: any) => {
    const firstError = Object.values(errors)[0] as any;
    toast({
        variant: 'destructive',
        title: 'VALIDATION FAILED',
        description: firstError?.message || 'Check required fields.'
    });
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          <div className="lg:col-span-2 space-y-8">
<<<<<<< HEAD
            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <UploadCloud className="text-primary h-5 w-5" /> MEDIA PIPELINE
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Images (Max 5)</Label>
=======
            <Card className="rounded-[2rem] border-white/5 bg-neutral-900/50 shadow-2xl overflow-hidden">
              <CardHeader className="p-8 border-b border-white/5 bg-white/5">
                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                    <UploadCloud className="text-primary h-5 w-5" /> MEDIA PIPELINE (CLOUDINARY)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Imagery (Max 5)</Label>
                    <span className="text-[8px] font-bold text-primary uppercase">CDN Handshake: Enabled</span>
                  </div>
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
                  <div className="grid grid-cols-5 gap-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-black/40 group hover:border-primary/40 transition-all">
                        {preview ? (
                          <>
                            <Image src={preview} alt="preview" fill className="object-cover" />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full z-10 opacity-0 group-hover:opacity-100" onClick={() => removeImage(i)}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <button type="button" className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-white transition-colors" onClick={() => imageInputRefs.current[i]?.click()}><ImageIcon className="h-5 w-5" /></button>
                        )}
                        <input type="file" className="hidden" ref={el => { imageInputRefs.current[i] = el; }} accept="image/*" onChange={(e) => handleImageChange(i, e)} />
                      </div>
                    ))}
                  </div>
                </div>
<<<<<<< HEAD
=======
                <Separator className="bg-white/5" />
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Product Videos (MP4/WebM)</Label>
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
                                <Loader2 className="h-5 w-5 animate-spin text-white" />
                            </div>
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full shadow-lg" onClick={() => removeVideo(i, false)}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                        ))}
                    </div>
                  )}
                </div>
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader><CardTitle>Product Details</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Title</FormLabel>
                    <FormControl><Input placeholder="e.g., Urban Techwear" {...field} /></FormControl>
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
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="used">Used</SelectItem></SelectContent>
                        </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea rows={6} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-4 w-4" /> Logistics</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <FormField control={form.control} name="stock" render={({ field }) => (
                        <FormItem><FormLabel>Quantity Available</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                        )} />
                        <FormField control={form.control} name="shippingCost" render={({ field }) => (
                        <FormItem><FormLabel>Shipping Cost (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                        )} />
                    </div>
                    <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                    <FormItem><FormLabel>Fulfillment Details</FormLabel><FormControl><Input placeholder="Dispatched via G4S within 24h" {...field} /></FormControl></FormItem>
                    )} />
                </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="rounded-2xl border-white/5 bg-neutral-900/50 shadow-xl">
              <CardHeader><CardTitle className="text-primary">VALUATION</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="localCurrency" render={({ field }) => (
                    <FormItem><FormLabel>Currency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{SUPPORTED_CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent></Select></FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem><FormLabel>Local Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Protocol Value (USD)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="wasPrice" render={({ field }) => (
                  <FormItem><FormLabel>Original Value (USD)</FormLabel><FormControl><Input type="number" step="0.01" value={field.value || ''} onChange={field.onChange} placeholder="Optional for discounts" /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>

<<<<<<< HEAD
            <Button type="submit" className="w-full h-16 rounded-xl font-black uppercase tracking-widest text-sm shadow-2xl" disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                PUBLISH SIGNAL
            </Button>

            <div className="p-4 rounded-xl bg-neutral-950 border border-white/5 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">Secure data sync active. Assets are distributed globally.</p>
=======
            <Card className="rounded-[2rem] border-white/5 bg-neutral-900/50 overflow-hidden shadow-2xl">
              <CardHeader className="p-6 border-b border-white/5 bg-white/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">LOGISTICS</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <FormField control={form.control} name="shippingCost" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Shipping Fee (USD)</FormLabel><FormControl><Input type="number" className="bg-black/40 border-white/10 h-10 rounded-lg" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                  <FormItem><FormLabel className="text-[10px] font-bold text-neutral-500 uppercase">Method</FormLabel><FormControl><Input placeholder="E.g. Wells Fargo Delivery" className="bg-black/40 border-white/10 h-10 rounded-lg" {...field} /></FormControl></FormItem>
                )} />
              </CardContent>

            <div className="p-6 pt-0 space-y-4">
                <Button type="submit" className="w-full h-20 rounded-[2.5rem] font-black uppercase text-lg shadow-2xl group relative overflow-hidden" disabled={isUploading}>
                    {isUploading ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <CheckCircle2 className="mr-3 h-8 w-8 group-hover:scale-110 transition-transform" />}
                    {productToEdit ? 'SYNC TO CDN' : 'PUBLISH SIGNAL'}
                </Button>
                {productToEdit && (
                    <Button type="button" variant="ghost" className="w-full h-12 font-black uppercase text-[10px] tracking-widest text-neutral-500" onClick={onFormSubmit}>
                        Abort Sequence
                    </Button>
                )}
>>>>>>> c3567a40d475592c471f27423a0f19bf073a94e7
            </div>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
