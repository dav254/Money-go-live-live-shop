

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
} from 'lucide-react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Switch } from '../ui/switch';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import type { Product } from '@/lib/types';
import { Label } from '../ui/label';

const formSchema = z.object({
  productName: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
  shippingCost: z.coerce.number().min(0, { message: 'Shipping cost must be a non-negative number.' }).default(0),
  salePrice: z.coerce.number().optional(),
  stock: z.coerce.number().int().min(0, { message: 'Stock must be a non-negative integer.' }),
  tags: z.string().optional(),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  location: z.string().min(2, { message: 'Location is required.' }),
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
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = !!productToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      category: '',
      price: 0,
      shippingCost: 0,
      salePrice: 0,
      stock: 0,
      tags: '',
      description: '',
      location: '',
      deliveryOptions: '',
      enableDiscount: false,
    },
  });

  useEffect(() => {
    if (isEditMode && productToEdit) {
      form.reset({
        productName: productToEdit.name || '',
        category: productToEdit.category || '',
        price: productToEdit.wasPrice || productToEdit.price || 0,
        salePrice: productToEdit.wasPrice ? productToEdit.price : 0,
        enableDiscount: !!productToEdit.wasPrice,
        stock: productToEdit.stock || 0,
        tags: productToEdit.tags || '',
        description: productToEdit.description || '',
        shippingCost: productToEdit.shippingCost || 0,
        location: productToEdit.location || '',
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
        body: JSON.stringify(paramsToSign),
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
                console.error('Cloudinary upload error:', xhr.responseText);
                reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`))
            }
        };

        xhr.onerror = () => {
            console.error('Network error during upload:', xhr.responseText);
            reject(new Error('Network error during upload.'));
        };

        xhr.send(formData);
    });
  };
  
  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to upload products.' });
        return;
    }

    setIsUploading(true);
    toast({ title: isEditMode ? 'Updating Product...' : 'Saving Product...', description: 'Your product is being saved.' });

    try {
      const uploadPromises = files.map(file => uploadToCloudinary(file));
      const newUploadedMedia = await Promise.all(uploadPromises);

      const newImageUrls = newUploadedMedia.filter(m => m.type.startsWith('image/')).map(m => m.url);
      const newVideoUrls = newUploadedMedia.filter(m => m.type.startsWith('video/')).map(m => m.url);

      const allImageUrls = [...existingImageUrls, ...newImageUrls];
      const allVideoUrls = [...existingVideoUrls, ...newVideoUrls];

      const productData: any = {
          name: values.productName,
          category: values.category,
          stock: values.stock,
          tags: values.tags || '',
          description: values.description,
          shippingCost: values.shippingCost,
          location: values.location,
          deliveryOptions: values.deliveryOptions,
          sellerId: user.uid,
          imageUrl: allImageUrls[0] || '',
          videoUrl: allVideoUrls[0] || '',
          imageUrls: allImageUrls,
          videoUrls: allVideoUrls,
          hasVideo: allVideoUrls.length > 0,
          updatedAt: serverTimestamp(),
      };

      if (values.enableDiscount && values.salePrice && values.salePrice < values.price) {
          productData.price = values.salePrice;
          productData.wasPrice = values.price;
      } else {
          productData.price = values.price;
          productData.wasPrice = null;
      }
      
      if (isEditMode && productToEdit) {
          const productRef = doc(firestore, 'products', productToEdit.id);
          await updateDoc(productRef, productData);
          toast({ title: 'Success!', description: 'Your product has been updated.' });
      } else {
          productData.uploadDate = serverTimestamp();
          const productsCollectionRef = collection(firestore, 'products');
          const newDocRef = await addDoc(productsCollectionRef, productData);
          toast({ title: 'Success!', description: 'Your product details have been saved.' });
          // Store new product ID for the next step in the studio flow
          if (onFormSubmit) {
            localStorage.setItem('selectedProductId', newDocRef.id);
          }
      }

      form.reset();
      setFiles([]);
      setExistingImageUrls([]);
      setExistingVideoUrls([]);
      setUploadProgress({});
      onFormSubmit?.();

    } catch (error) {
        console.error('Error during product submission:', error);
        toast({ variant: 'destructive', title: 'Submission Failed', description: (error as Error).message || 'Could not save your product. Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };
  
  const enableDiscount = form.watch('enableDiscount');
  
  const allMediaCount = files.length + existingImageUrls.length + existingVideoUrls.length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{isEditMode ? 'Edit Product' : 'Add New Product'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Single Column Layout */}
            <div className="flex flex-col gap-8">
              {/* Main Info */}
              <div className="space-y-6">
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

              {/* Media Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Media Uploads</CardTitle>
                  <CardDescription>Add up to 5 images and videos.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="file-upload" className="sr-only">Product Images & Videos</Label>
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
                        className="w-full border-dashed"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || allMediaCount >= 5}
                    >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        {isUploading ? 'Uploading...' : `Select Files (${5 - allMediaCount} remaining)`}
                    </Button>
                  </div>
                  {(files.length > 0 || existingImageUrls.length > 0 || existingVideoUrls.length > 0) && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
                          {existingImageUrls.map((url) => (
                              <div key={url} className="relative aspect-square group">
                                  <Image src={url} alt="Existing product image" fill className="object-cover rounded-md" />
                                  <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleExistingMediaRemove(url, 'image')}><X className="h-4 w-4" /></Button>
                              </div>
                          ))}
                          {existingVideoUrls.map((url) => (
                              <div key={url} className="relative aspect-square group bg-black">
                                  <video src={url} className="object-cover rounded-md h-full w-full" muted />
                                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Video className="h-6 w-6 text-white"/></div>
                                  <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleExistingMediaRemove(url, 'video')}><X className="h-4 w-4" /></Button>
                              </div>
                          ))}
                          {files.map(file => (
                              <div key={file.name} className="relative aspect-square group">
                                  <Image src={URL.createObjectURL(file)} alt={file.name} fill className="object-cover rounded-md" />
                                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2">
                                      <p className="text-white text-xs text-center truncate w-full">{file.name}</p>
                                      {uploadProgress[file.name] !== undefined && <Progress value={uploadProgress[file.name]} className="h-1 mt-1 w-full" />}
                                  </div>
                                  <Button type="button" size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleFileRemove(file.name)}><X className="h-4 w-4" /></Button>
                              </div>
                          ))}
                      </div>
                  )}
                </CardContent>
              </Card>

              {/* Pricing and Inventory */}
              <Card>
                <CardHeader><CardTitle className="text-lg">Pricing & Inventory</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Original Price (USD)</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 25.00" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="enableDiscount" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel>Enable Discount</FormLabel>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                  )} />
                  {enableDiscount && (
                    <FormField control={form.control} name="salePrice" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Sale Price (USD)</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g., 19.99" {...field} /></FormControl>
                            <FormDescription>Must be lower than original price.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="stock" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Stock Quantity</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 50" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                </CardContent>
              </Card>
              
               {/* Organization */}
              <Card>
                  <CardHeader><CardTitle className="text-lg">Organization</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                      <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Category</FormLabel>
                              <FormControl><Input placeholder="e.g., Apparel" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="tags"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Tags / Hashtags</FormLabel>
                              <FormControl><Input placeholder="e.g., #summer, #tshirt, #fashion" {...field} /></FormControl>
                              <FormDescription>Separate with commas.</FormDescription>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                  </CardContent>
              </Card>

              {/* Logistics */}
              <Card>
                  <CardHeader><CardTitle className="text-lg">Logistics</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                       <FormField control={form.control} name="shippingCost" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Shipping Cost (USD)</FormLabel>
                              <FormControl><Input type="number" placeholder="e.g., 5.00" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                       <FormField control={form.control} name="location" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Ships From (City, Country)</FormLabel>
                              <FormControl><Input placeholder="e.g., Nairobi, Kenya" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                       <FormField control={form.control} name="deliveryOptions" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Delivery Options</FormLabel>
                              <FormControl><Input placeholder="e.g., Standard, Express, Local Pickup" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                  </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline">Save as Draft</Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save and Continue')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
