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
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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

  const isAtLimit = !productToEdit && dailyCount >= DAILY_FREE_LIMIT;

  useEffect(() => {
    if (!user || !firestore || !!productToEdit) return;

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
  }, [user, firestore, productToEdit]);

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
      area: productToEdit?.area || '',
      deliveryOptions: productToEdit?.deliveryOptions || '',
      enableDiscount: !!productToEdit?.wasPrice,
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const uploadFileToFirebase = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storage = getStorage();
      const storageRef = ref(storage, `products/${user?.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        }, 
        (error) => reject(error), 
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsUploading(true);

    try {
      const uploadedUrls = await Promise.all(files.map(file => uploadFileToFirebase(file)));
      const imageUrls = [...existingImageUrls, ...uploadedUrls.filter(url => !url.includes('.mp4') && !url.includes('.webm'))];
      const videoUrls = [...existingVideoUrls, ...uploadedUrls.filter(url => url.includes('.mp4') || url.includes('.webm'))];

      const productData = {
        ...values,
        sellerId: user.uid,
        imageUrl: imageUrls[0] || '',
        videoUrl: videoUrls[0] || '',
        imageUrls,
        videoUrls,
        uploadDate: serverTimestamp(),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData);
      } else {
        await addDoc(collection(firestore, 'products'), productData);
      }

      toast({ title: 'Success', description: 'Product saved successfully!' });
      onFormSubmit?.();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to upload product.' });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{productToEdit ? 'Edit Product' : 'Upload Product'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="productName" render={({ field }) => (
              <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>Price (USD)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem><FormLabel>Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="space-y-2">
              <Label>Product Media</Label>
              <Input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} />
              {files.length > 0 && (
                <div className="space-y-2 mt-2">
                  {files.map(file => (
                    <div key={file.name} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span>{file.name}</span>
                        <span>{Math.round(uploadProgress[file.name] || 0)}%</span>
                      </div>
                      <Progress value={uploadProgress[file.name] || 0} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isUploading}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <UploadCloud className="mr-2" />}
              {productToEdit ? 'Update Product' : 'Publish Product'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
