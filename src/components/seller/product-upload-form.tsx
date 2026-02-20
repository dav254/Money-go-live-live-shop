'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  MapPin,
  Truck,
  Video,
  BadgeCent,
  Loader2,
  Globe,
  ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useFirestore, useUser } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Product } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kenyaLocations } from '@/lib/location-data';
import { PRODUCT_CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

const MAX_IMAGES = 5;

const formSchema = z.object({
  productName: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  currency: z.string().default('KES'),
  localPrice: z.coerce.number().min(0, { message: 'Local price must be a positive number.' }),
  price: z.coerce.number().min(0, { message: 'USD Price must be a positive number.' }),
  shippingCost: z.coerce.number().min(0, { message: 'Shipping cost must be a non-negative number.' }).default(0),
  stock: z.coerce.number().int().min(0, { message: 'Stock must be a non-negative integer.' }),
  tags: z.string().optional(),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  country: z.string().min(1, { message: 'Country is required.' }),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  area: z.string().min(2, { message: 'City or Area is required.' }),
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
  const storage = getStorage();
  const { toast } = useToast();

  const [imageFiles, setImageFiles] = useState<(File | string | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>(productToEdit?.videoUrls || []);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (productToEdit) {
      const images = [...(productToEdit.imageUrls || [])];
      while (images.length < MAX_IMAGES) images.push(null);
      setImageFiles(images.slice(0, MAX_IMAGES));
      setExistingVideoUrls(productToEdit.videoUrls || []);
    }
  }, [productToEdit]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: productToEdit?.name || '',
      category: productToEdit?.category || '',
      currency: productToEdit?.localCurrency || 'KES',
      localPrice: productToEdit?.localPrice || 0,
      price: productToEdit?.price || 0,
      shippingCost: productToEdit?.shippingCost || 0,
      stock: productToEdit?.stock || 0,
      description: productToEdit?.description || '',
      country: productToEdit?.country || 'Kenya',
      county: productToEdit?.county || '',
      subCounty: productToEdit?.subCounty || '',
      area: productToEdit?.area || '',
      deliveryOptions: productToEdit?.deliveryOptions || '',
      wasPrice: productToEdit?.wasPrice || undefined,
    },
  });

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
      // 1. Upload Images
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

      // 2. Upload Videos
      const finalVideoUrls: string[] = [...existingVideoUrls];
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const path = `products/${user.uid}/${Date.now()}_vid_${i}_${file.name}`;
        const url = await uploadFile(file, path);
        finalVideoUrls.push(url);
      }

      const productData = {
        ...values,
        sellerId: user.uid,
        imageUrl: finalImageUrls[0] || '',
        imageUrls: finalImageUrls,
        videoUrl: finalVideoUrls[0] || '',
        videoUrls: finalVideoUrls,
        localCurrency: values.currency,
        updatedAt: serverTimestamp(),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData);
        toast({ title: 'Product Updated!' });
      } else {
        await addDoc(collection(firestore, 'products'), {
          ...productData,
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
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setIsUploading(false);
    }
  }

  const selectedCounty = form.watch('county');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Give your product a clear name and detailed description.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="productName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Vintage Leather Jacket" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Description</FormLabel>
                    <FormControl><Textarea rows={6} placeholder="Describe features, size, material, etc." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Media */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ImageIcon className="text-primary" /> Product Media</CardTitle>
                <CardDescription>Upload exactly 5 high-quality images and optional videos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-4 block">Product Images (5 Required)</Label>
                  <div className="grid grid-cols-5 gap-2">
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
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" 
                              onClick={() => removeImage(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <button 
                            type="button" 
                            className="w-full h-full flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors"
                            onClick={() => imageInputRefs.current[i]?.click()}
                          >
                            <UploadCloud className="h-5 w-5 text-muted-foreground" />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Slot {i + 1}</span>
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

                <Separator />

                <div>
                  <Label className="mb-4 block">Product Videos (Optional)</Label>
                  <div className="space-y-4">
                    <Input type="file" accept="video/*" multiple onChange={handleVideoChange} />
                    <div className="grid grid-cols-3 gap-4">
                      {existingVideoUrls.map((url, i) => (
                        <div key={`ex-${i}`} className="relative aspect-video rounded-lg overflow-hidden border bg-black group">
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
                            <span className="text-[10px] font-black text-white">{Math.round(uploadProgress[file.name] || 0)}%</span>
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

          <div className="space-y-8">
            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="text-primary" /> Pricing & Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="localPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Local Price</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market Price (USD Equiv.)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormDescription>Calculated price for global buyers.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Logistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck className="text-primary" /> Logistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="country" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl><Input readOnly {...field} /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="county" render={({ field }) => (
                    <FormItem>
                      <FormLabel>County</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.keys(kenyaLocations).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subCounty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-County</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedCounty}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {selectedCounty && kenyaLocations[selectedCounty]?.map(sc => <SelectItem key={c} value={sc}>{sc}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="area" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City / Specific Area</FormLabel>
                    <FormControl><Input placeholder="e.g. Westlands, CBD" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="shippingCost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Fee (USD)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Method Description</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="e.g. Same day via Boda, 2 days via G4S" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl shadow-primary/20" disabled={isUploading}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              {productToEdit ? 'Update Product' : 'Publish to Marketplace'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
