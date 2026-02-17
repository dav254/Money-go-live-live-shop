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
  Info,
  DollarSign,
  MapPin,
  Truck,
  Image as ImageIcon,
  Video,
  ShieldAlert,
  BadgeCent,
  Loader2,
  Globe,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useFirestore, useUser, useUserProfile, errorEmitter } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs, writeBatch, increment, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Product } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kenyaLocations } from '@/lib/location-data';
import { PRODUCT_CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

const DAILY_FREE_LIMIT = 10;
const PREMIUM_UPLOAD_COST = 10;

const formSchema = z.object({
  productName: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  currency: z.string().default('KES'),
  customCurrencyCode: z.string().optional(),
  localPrice: z.coerce.number().min(0, { message: 'Local price must be a positive number.' }),
  price: z.coerce.number().min(0, { message: 'USD Price must be a positive number.' }),
  shippingCost: z.coerce.number().min(0, { message: 'Shipping cost must be a non-negative number.' }).default(0),
  salePrice: z.coerce.number().optional(),
  stock: z.coerce.number().int().min(0, { message: 'Stock must be a non-negative integer.' }),
  tags: z.string().optional(),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  country: z.string().min(1, { message: 'Country is required.' }),
  county: z.string().optional(),
  subCounty: z.string().optional(),
  stateProvince: z.string().optional(),
  area: z.string().min(2, { message: 'City or Area is required.' }),
  deliveryOptions: z.string().min(5, { message: 'Please describe delivery options.' }),
  enableDiscount: z.boolean().default(false),
});

interface ProductUploadFormProps {
  productToEdit?: Product;
  onFormSubmit?: () => void;
}

export function ProductUploadForm({ productToEdit, onFormSubmit }: ProductUploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!productToEdit;

  useEffect(() => {
    if (!user || !firestore || isEditMode) return;

    const fetchDailyCount = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      const q = query(
        collection(firestore, 'products'),
        where('sellerId', '==', user.uid),
        where('uploadDate', '>=', todayTimestamp)
      );

      try {
        const snap = await getDocs(q);
        setDailyCount(snap.size);
      } catch (err) {
        console.error("Error fetching daily upload count:", err);
      }
    };

    fetchDailyCount();
  }, [user, firestore, isEditMode]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      category: '',
      currency: 'KES',
      customCurrencyCode: '',
      localPrice: 0,
      price: 0,
      shippingCost: 0,
      salePrice: 0,
      stock: 0,
      tags: '',
      description: '',
      country: 'Kenya',
      county: '',
      subCounty: '',
      stateProvince: '',
      area: '',
      deliveryOptions: '',
      enableDiscount: false,
    },
  });

  const selectedCountry = form.watch('country');
  const selectedCounty = form.watch('county');
  const selectedCurrency = form.watch('currency');
  const customCurrencyCode = form.watch('customCurrencyCode');
  const isAtLimit = !isEditMode && dailyCount >= DAILY_FREE_LIMIT;

  const activeCurrency = selectedCurrency === 'OTHER' ? (customCurrencyCode || 'LOCAL') : selectedCurrency;

  useEffect(() => {
    if (isEditMode && productToEdit) {
      const isKnownCurrency = SUPPORTED_CURRENCIES.some(c => c.code === productToEdit.localCurrency);
      
      form.reset({
        productName: productToEdit.name || '',
        category: productToEdit.category || '',
        currency: isKnownCurrency ? (productToEdit.localCurrency || 'USD') : 'OTHER',
        customCurrencyCode: isKnownCurrency ? '' : productToEdit.localCurrency,
        localPrice: productToEdit.localPrice || productToEdit.price || 0,
        price: productToEdit.price || 0,
        salePrice: productToEdit.wasPrice ? productToEdit.price : 0,
        enableDiscount: !!productToEdit.wasPrice,
        stock: productToEdit.stock || 0,
        tags: productToEdit.tags || '',
        description: productToEdit.description || '',
        shippingCost: productToEdit.shippingCost || 0,
        country: productToEdit.country || 'Kenya',
        county: productToEdit.county || '',
        subCounty: productToEdit.subCounty || '',
        stateProvince: productToEdit.stateProvince || '',
        area: productToEdit.area || '',
        deliveryOptions: productToEdit.deliveryOptions || '',
      });
      setExistingImageUrls(productToEdit.imageUrls || (productToEdit.imageUrl ? [productToEdit.imageUrl] : []));
      setExistingVideoUrls(productToEdit.videoUrls || (productToEdit.videoUrl ? [productToEdit.videoUrl] : []));
    }
  }, [productToEdit, isEditMode, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...newFiles].slice(0, 5 - (existingImageUrls.length + existingVideoUrls.length)));
    }
  };

  const handleFileRemove = (fileName: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName));
  };
  
  const handleExistingMediaRemove = (url: string, type: 'image' | 'video') => {
      if (type === 'image') {
          setExistingImageUrls(prev => prev.filter(u => u !== url));
      } else {
          setExistingVideoUrls(prev => prev.filter(u => u !== url));
      }
  }

 const uploadToCloudinary = async (file: File): Promise<{ url: string, type: string }> => {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const paramsToSign = { timestamp };

    const signatureResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
    });
    const { signature } = await signatureResponse.json();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '');
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const progress = (event.loaded / event.total) * 100;
                setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const uploadedData = JSON.parse(xhr.responseText);
                resolve({ url: uploadedData.secure_url, type: file.type });
            } else {
                reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`))
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload.'));
        };

        xhr.send(formData);
    });
  };
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Database connection lost.' });
        return;
    }

    if (isAtLimit && (userProfile?.aiPoints || 0) < PREMIUM_UPLOAD_COST) {
        toast({
            variant: 'destructive',
            title: 'Insufficient Points',
            description: `You have used your ${DAILY_FREE_LIMIT} free daily uploads. Premium uploads cost ${PREMIUM_UPLOAD_COST} points.`,
        });
        return;
    }

    setIsUploading(true);
    toast({ title: isEditMode ? 'Updating...' : 'Publishing...', description: 'Please wait.' });

    try {
      const uploadPromises = files.map(file => uploadToCloudinary(file));
      const newUploadedMedia = await Promise.all(uploadPromises);

      const newImageUrls = newUploadedMedia.filter(m => m.type.startsWith('image/')).map(m => m.url);
      const newVideoUrls = newUploadedMedia.filter(m => m.type.startsWith('video/')).map(m => m.url);

      const allImageUrls = [...existingImageUrls, ...newImageUrls];
      const allVideoUrls = [...existingVideoUrls, ...newVideoUrls];

      let locationStr = values.area;
      if (values.country === 'Kenya') {
          locationStr = `${values.area}, ${values.subCounty}, ${values.county}, Kenya`;
      } else {
          locationStr = `${values.area}, ${values.stateProvince}, ${values.country}`;
      }

      const finalCurrency = values.currency === 'OTHER' ? (values.customCurrencyCode || 'LOCAL') : values.currency;

      const productData: any = {
          name: values.productName,
          category: values.category,
          stock: values.stock,
          tags: values.tags || '',
          description: values.description,
          shippingCost: values.shippingCost,
          country: values.country,
          county: values.country === 'Kenya' ? values.county : null,
          subCounty: values.country === 'Kenya' ? values.subCounty : null,
          stateProvince: values.country !== 'Kenya' ? values.stateProvince : null,
          area: values.area,
          location: locationStr,
          deliveryOptions: values.deliveryOptions,
          sellerId: user.uid,
          localCurrency: finalCurrency,
          localPrice: values.localPrice,
          price: values.price,
          imageUrl: allImageUrls[0] || '',
          videoUrl: allVideoUrls[0] || '',
          imageUrls: allImageUrls,
          videoUrls: allVideoUrls,
          hasVideo: allVideoUrls.length > 0,
          updatedAt: serverTimestamp(),
      };

      if (values.enableDiscount && values.salePrice && values.salePrice < values.localPrice) {
          productData.wasPrice = values.price;
          productData.price = (values.salePrice / values.localPrice) * values.price;
      } else {
          productData.wasPrice = null;
      }
      
      if (isEditMode && productToEdit) {
          const productRef = doc(firestore, 'products', productToEdit.id);
          await updateDoc(productRef, productData);
          toast({ title: 'Success!', description: 'Product updated.' });
      } else {
          productData.uploadDate = serverTimestamp();
          const batch = writeBatch(firestore);
          const productsCollectionRef = collection(firestore, 'products');
          const newDocRef = doc(productsCollectionRef);
          
          batch.set(newDocRef, { ...productData, id: newDocRef.id });

          if (isAtLimit) {
              const userRef = doc(firestore, 'userProfiles', user.uid);
              batch.update(userRef, { aiPoints: increment(-PREMIUM_UPLOAD_COST) });
          }

          await batch.commit().catch(err => {
              const permissionError = new FirestorePermissionError({
                  path: 'products',
                  operation: 'create',
                  requestResourceData: productData
              });
              errorEmitter.emit('permission-error', permissionError);
              throw permissionError;
          });

          setDailyCount(prev => prev + 1);
          toast({ title: 'Published!', description: isAtLimit ? `Premium upload successful (-${PREMIUM_UPLOAD_COST} points)` : 'Product is now live.' });
      }

      form.reset();
      setFiles([]);
      setExistingImageUrls([]);
      setExistingVideoUrls([]);
      setUploadProgress({});
      onFormSubmit?.();

    } catch (error) {
        console.error('Submission failed:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Process failed. Please check your point balance.' });
    } finally {
      setIsUploading(false);
    }
  };
  
  const enableDiscount = form.watch('enableDiscount');
  const allMediaCount = files.length + existingImageUrls.length + existingVideoUrls.length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
        <Card className="border-none sm:border shadow-none sm:shadow-sm">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl">{isEditMode ? 'Edit Product' : 'Add New Product'}</CardTitle>
            {!isEditMode && (
                <Alert variant={isAtLimit ? "destructive" : "default"} className={cn("mt-4", !isAtLimit && "bg-primary/5 border-primary/20")}>
                    {isAtLimit ? <ShieldAlert className="h-4 w-4" /> : <Info className="h-4 w-4 text-primary" />}
                    <AlertTitle className="text-sm font-bold">
                        {isAtLimit ? 'Daily Free Limit Reached' : 'Daily Upload Policy'}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                        {isAtLimit 
                            ? `You have used your ${DAILY_FREE_LIMIT} free daily uploads. Each additional upload today will cost ${PREMIUM_UPLOAD_COST} AI Points.`
                            : `You have used ${dailyCount}/${DAILY_FREE_LIMIT} free uploads for today.`
                        }
                    </AlertDescription>
                </Alert>
            )}
          </CardHeader>
          <CardContent className="space-y-6 sm:space-y-8 px-4 sm:px-6">
            <div className="flex flex-col gap-6 sm:gap-8">
              <div className="space-y-4 sm:space-y-6">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Summer Vibes T-Shirt" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description / Features</FormLabel>
                      <FormControl>
                        <Textarea rows={6} placeholder="Describe your product in detail..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Card className="bg-muted/30">
                <CardHeader className="p-4">
                  <CardTitle className="text-base sm:text-lg">Media Gallery</CardTitle>
                  <CardDescription className="text-xs">Add up to 5 items (images or videos).</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <input
                        id="file-upload"
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isUploading || allMediaCount >= 5}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full border-dashed h-24 flex-col gap-2 bg-background hover:bg-muted/50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || allMediaCount >= 5}
                    >
                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                            {isUploading ? 'System Busy...' : `Select Media (${5 - allMediaCount} spots open)`}
                        </span>
                    </Button>
                  </div>
                  {(files.length > 0 || existingImageUrls.length > 0 || existingVideoUrls.length > 0) && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 mt-4">
                          {existingImageUrls.map((url) => (
                              <div className="relative aspect-square group">
                                  <Image src={url} alt="Media" fill className="object-cover rounded-xl" />
                                  <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 rounded-full" onClick={() => handleExistingMediaRemove(url, 'image')}><X className="h-4 w-4" /></Button>
                              </div>
                          ))}
                          {existingVideoUrls.map((url) => (
                              <div className="relative aspect-square group bg-black rounded-xl overflow-hidden">
                                  <video src={url} className="object-cover h-full w-full" muted />
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Video className="h-6 w-6 text-white"/></div>
                                  <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 rounded-full" onClick={() => handleExistingMediaRemove(url, 'video')}><X className="h-4 w-4" /></Button>
                              </div>
                          ))}
                          {files.map(file => (
                              <div key={file.name} className="relative aspect-square group rounded-xl overflow-hidden">
                                  {file.type.startsWith('image/') ? (
                                      <Image src={URL.createObjectURL(file)} alt={file.name} fill className="object-cover" />
                                  ) : (
                                      <div className="h-full w-full bg-neutral-800 flex items-center justify-center"><Video className="h-6 w-6" /></div>
                                  )}
                                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {uploadProgress[file.name] !== undefined && <Progress value={uploadProgress[file.name]} className="h-1 mt-1 w-full" />}
                                  </div>
                                  <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => handleFileRemove(file.name)}><X className="h-4 w-4" /></Button>
                              </div>
                          ))}
                      </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-muted/30">
                    <CardHeader className="p-4">
                        <CardTitle className="text-base sm:text-lg">Pricing & Multi-Currency</CardTitle>
                        <CardDescription className="text-xs">Full control over local and international prices.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-1 gap-4">
                        <FormField control={form.control} name="currency" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Local Currency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {SUPPORTED_CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        
                        {selectedCurrency === 'OTHER' && (
                            <FormField control={form.control} name="customCurrencyCode" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Add Your Currency Code</FormLabel>
                                    <FormControl><Input placeholder="e.g., UGX" maxLength={3} className="h-9 uppercase" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="localPrice" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Local Price ({activeCurrency})</FormLabel>
                                <FormControl><Input type="number" placeholder="0.00" className="h-9" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    
                    <FormField control={form.control} name="price" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2 text-xs">
                                <DollarSign className="h-3.5 w-3.5 text-primary" />
                                International Price (USD)
                            </FormLabel>
                            <FormControl><Input type="number" placeholder="0.00" className="h-9" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="enableDiscount" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-xl border p-3 bg-background">
                            <div className="space-y-0.5">
                                <FormLabel className="text-xs">On Sale</FormLabel>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )} />
                    {enableDiscount && (
                        <FormField control={form.control} name="salePrice" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Sale Price ({activeCurrency})</FormLabel>
                                <FormControl><Input type="number" placeholder="0.00" className="h-9" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    )}
                    </CardContent>
                </Card>

                <Card className="bg-muted/30">
                    <CardHeader className="p-4"><CardTitle className="text-base sm:text-lg">Inventory & Logistics</CardTitle></CardHeader>
                    <CardContent className="space-y-4 px-4 pb-4">
                        <FormField control={form.control} name="stock" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Total Stock</FormLabel>
                                <FormControl><Input type="number" placeholder="0" className="h-9" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Pick one..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {PRODUCT_CATEGORIES.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="shippingCost" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Flat Shipping Fee ({activeCurrency})</FormLabel>
                                <FormControl><Input type="number" placeholder="0.00" className="h-9" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                </Card>
              </div>
              
              <Card className="bg-muted/30">
                  <CardHeader className="p-4">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2"><Globe className="h-4 w-4" /> Location & Shipping</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-4 pb-4">
                      <FormField
                          control={form.control}
                          name="country"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-xs">Country</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                      <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Select Country" />
                                      </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      <SelectItem value="Kenya">Kenya</SelectItem>
                                      <SelectItem value="Nigeria">Nigeria</SelectItem>
                                      <SelectItem value="Tanzania">Tanzania</SelectItem>
                                      <SelectItem value="Uganda">Uganda</SelectItem>
                                      <SelectItem value="United States">United States</SelectItem>
                                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                                      <SelectItem value="International">Other / International</SelectItem>
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                          )}
                      />

                      {selectedCountry === 'Kenya' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="county"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">County</FormLabel>
                                    <Select onValueChange={(val) => { field.onChange(val); form.setValue('subCounty', ''); }} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select County" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.keys(kenyaLocations).map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="subCounty"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Sub-county</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCounty}>
                                        <FormControl>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select Sub-county" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {selectedCounty && kenyaLocations[selectedCounty].map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                          </div>
                      ) : (
                          <FormField
                              control={form.control}
                              name="stateProvince"
                              render={({ field }) => (
                              <FormItem>
                                  <FormLabel className="text-xs">State / Province / Region</FormLabel>
                                  <FormControl><Input placeholder="e.g., Lagos" className="h-9" {...field} /></FormControl>
                                  <FormMessage />
                              </FormItem>
                              )}
                          />
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="area"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">{selectedCountry === 'Kenya' ? 'Area / Neighborhood' : 'City / Town'}</FormLabel>
                                <FormControl><Input placeholder={selectedCountry === 'Kenya' ? "e.g., Kilimani" : "e.g., Beverly Hills"} className="h-9" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                          <FormItem>
                              <FormLabel className="text-xs">Delivery Terms</FormLabel>
                              <FormControl><Input placeholder="e.g., Same-day via Boda" className="h-9" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                      </div>
                  </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 border-t p-4 sm:p-6 bg-muted/10 sticky bottom-0 z-10">
            <div className="flex flex-col sm:flex-row w-full justify-between items-center gap-4">
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                    {isAtLimit && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                            <BadgeCent className="h-4 w-4 text-primary" />
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary">PREMIUM UPLOAD ACTIVE</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <Button type="button" variant="ghost" className="flex-1 sm:flex-none font-bold uppercase tracking-widest text-[10px]">Save Draft</Button>
                    <Button type="submit" size="lg" className="flex-1 sm:flex-none px-8 sm:px-12 font-black rounded-xl shadow-xl shadow-primary/20" disabled={isUploading}>
                        {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : isAtLimit ? (
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 fill-current" />
                                <span className="text-xs sm:text-sm uppercase">PAY {PREMIUM_UPLOAD_COST} PTS</span>
                            </div>
                        ) : (
                            <span className="text-xs sm:text-sm uppercase">{isEditMode ? 'UPDATE' : 'PUBLISH'}</span>
                        )}
                    </Button>
                </div>
            </div>
            {isAtLimit && (userProfile?.aiPoints || 0) < PREMIUM_UPLOAD_COST && (
                <p className="text-[10px] sm:text-xs text-destructive font-bold text-center">
                    Low balance. <Link href="/dashboard/seller/ai-tools" className="underline">Top up to publish</Link>.
                </p>
            )}
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
