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
  DollarSign,
  Truck,
  Loader2,
  ImageIcon,
  CheckCircle2,
  Tag as TagIcon,
  Percent,
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

  const [imageFiles, setImageFiles] = useState<(File | string | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>(productToEdit?.videoUrls || []);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: productToEdit?.name || '',
      brand: productToEdit?.brand || '',
      category: productToEdit?.category || 'Other',
      condition: productToEdit?.condition || 'new',
      localCurrency: productToEdit?.localCurrency || 'KES',
      localPrice: productToEdit?.localPrice || 0,
      price: productToEdit?.price || 0,
      shippingCost: productToEdit?.shippingCost || 0,
      stock: productToEdit?.stock || 0,
      description: productToEdit?.description || '',
      tags: productToEdit?.tags || '',
      deliveryOptions: productToEdit?.deliveryOptions || '',
      wasPrice: productToEdit?.wasPrice || undefined,
    },
  });

  useEffect(() => {
    if (productToEdit) {
      const images = [...(productToEdit.imageUrls || [])];
      while (images.length < MAX_IMAGES) images.push(null);
      setImageFiles(images.slice(0, MAX_IMAGES));
      setExistingVideoUrls(productToEdit.videoUrls || []);
      
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
      const newFiles = [...imageFiles];
      newFiles[index] = file;
      setImageFiles(newFiles);
    }
  };

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setVideoFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);
  };

  const removeVideo = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingVideoUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      setVideoFiles(prev => prev.filter((_, i) => i !== index));
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
      const finalImageUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const item = imageFiles[i];
        if (typeof item === 'string') {
          finalImageUrls.push(item);
        } else if (item instanceof File) {
          const path = `products/${user.uid}/${Date.now()}_img_${i}_${item.name}`;
          const url = await uploadFile(item, path);
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

      const baseProductData = {
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
        // When updating, explicitly OMIT sellerId to satisfy diff rules if necessary
        const { ...updateData } = baseProductData;
        await updateDoc(doc(firestore, 'products', productToEdit.id), updateData);
        toast({ title: 'Product Updated!' });
      } else {
        // When creating, we MUST include the sellerId
        await addDoc(collection(firestore, 'products'), {
          ...baseProductData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          inCartCount: 0,
        });
        toast({ title: 'Product Published!' });
      }

      onFormSubmit?.();
    } catch (error: any) {
      console.error(error);
      toast({ 
          variant: 'destructive', 
          title: 'Upload Failed', 
          description: error.code === 'permission-denied' 
            ? "Access Denied: Check your account status or media format." 
            : error.message 
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full max-w-full overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-xl md:text-2xl">Basic Information</CardTitle>
                <CardDescription className="text-xs md:text-sm">Give your product a clear name and detailed description.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Leather Jacket" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="brand" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl><Input placeholder="e.g. Nike" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="condition" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="new">Brand New</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                   <FormField control={form.control} name="tags" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search Tags</FormLabel>
                      <FormControl><Input placeholder="summer, leather" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Description</FormLabel>
                    <FormControl><Textarea rows={6} placeholder="Describe features..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl"><ImageIcon className="text-primary h-5 w-5" /> Product Media</CardTitle>
                <CardDescription className="text-xs md:text-sm">Upload exactly 5 high-quality images and optional videos.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-6">
                <div>
                  <Label className="mb-4 block text-sm">Product Images (5 Slots)</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 md:gap-3">
                    {imageFiles.map((file, i) => (
                      <div key={i} className="relative aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/50 group">
                        {file ? (
                          <>
                            <Image 
                              src={typeof file === 'string' ? file : URL.createObjectURL(file)} 
                              alt={`Product ${i + 1}`} 
                              fill 
                              className="object-cover" 
                            />
                            <Button 
                              type="button" 
                              variant="destructive" 
                              size="icon" 
                              className="absolute top-1 right-1 h-6 w-6" 
                              onClick={() => removeImage(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <button 
                            type="button" 
                            className="w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors p-1"
                            onClick={() => imageInputRefs.current[i]?.click()}
                          >
                            <UploadCloud className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[8px] font-black uppercase text-muted-foreground">Slot {i + 1}</span>
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

                <div>
                  <Label className="mb-4 block text-sm">Videos (Optional)</Label>
                  <div className="space-y-4">
                    <Input type="file" accept="video/*" multiple onChange={handleVideoChange} className="text-xs" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-4">
                      {existingVideoUrls.map((url, i) => (
                        <div key={`ex-${i}`} className="relative aspect-video rounded-lg overflow-hidden border bg-black">
                          <video src={url} className="w-full h-full object-cover" muted />
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="absolute top-1 right-1 h-6 w-6" 
                            onClick={() => removeVideo(i, true)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {videoFiles.map((file, i) => (
                        <div key={`new-${i}`} className="relative aspect-video rounded-lg overflow-hidden border bg-black group">
                          <video src={URL.createObjectURL(file)} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-[8px] font-black text-white">{Math.round(uploadProgress[file.name] || 0)}%</span>
                          </div>
                          <Button 
                            type="button" 
                            variant="destructive" 
                            size="icon" 
                            className="absolute top-1 right-1 h-6 w-6" 
                            onClick={() => removeVideo(i, false)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 md:space-y-8">
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl"><Percent className="text-primary h-5 w-5" /> Pricing</CardTitle>
                <CardDescription className="text-xs md:text-sm">Set your selling price and discounts.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="localCurrency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="text-xs"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code} className="text-xs">{curr.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ({form.watch('localCurrency')})</FormLabel>
                      <FormControl><Input type="number" {...field} className="text-xs" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Global Price (USD)</FormLabel>
                    <FormControl><Input type="number" {...field} className="text-xs" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="wasPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Original Price (USD)</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} className="text-xs" /></FormControl>
                      <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units Available</FormLabel>
                    <FormControl><Input type="number" {...field} className="text-xs" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-xl md:text-2xl"><Truck className="text-primary h-5 w-5" /> Logistics</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0 space-y-4">
                <FormField control={form.control} name="shippingCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping (USD)</FormLabel>
                    <FormControl><Input type="number" {...field} className="text-xs" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Dispatch terms..." {...field} className="text-xs" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-14 md:h-16 font-black uppercase tracking-widest text-base md:text-lg shadow-xl shadow-primary/20" disabled={isUploading}>
              {isUploading ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
              {productToEdit ? 'UPDATE' : 'PUBLISH'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}