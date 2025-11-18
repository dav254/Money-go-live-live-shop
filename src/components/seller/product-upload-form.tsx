
'use client';

import { useState } from 'react';
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
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  MapPin,
  Truck,
} from 'lucide-react';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Switch } from '../ui/switch';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  productName: z.string().min(2, { message: 'Product name must be at least 2 characters.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
  salePrice: z.coerce.number().optional(),
  stock: z.coerce.number().int().min(0, { message: 'Stock must be a non-negative integer.' }),
  tags: z.string().optional(),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  location: z.string().min(2, { message: 'Location is required.' }),
  deliveryOptions: z.string().min(5, { message: 'Please describe delivery options.' }),
  enableDiscount: z.boolean().default(false),
});

export function ProductUploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      category: '',
      price: 0,
      salePrice: 0,
      stock: 0,
      tags: '',
      description: '',
      location: '',
      deliveryOptions: '',
      enableDiscount: false,
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...newFiles].slice(0, 5)); // Allow up to 5 files
    }
  };

  const handleFileRemove = (fileName: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName));
  };

  const uploadToCloudinary = async (file: File): Promise<{ url: string, type: string }> => {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const paramsToSign = { timestamp };
    
    // 1. Get signature from our API
    const signatureResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paramsToSign }),
    });
    const { signature } = await signatureResponse.json();

    // 2. Upload file directly to Cloudinary
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
                reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
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
    if (files.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please upload at least one image or video.' });
        return;
    }

    setIsUploading(true);
    toast({ title: 'Starting Uploads', description: 'Your files are being uploaded to the cloud.' });

    try {
      const uploadPromises = files.map(file => uploadToCloudinary(file));
      const uploadedMedia = await Promise.all(uploadPromises);

      const imageUrls = uploadedMedia.filter(m => m.type.startsWith('image/')).map(m => m.url);
      const videoUrls = uploadedMedia.filter(m => m.type.startsWith('video/')).map(m => m.url);

      const productData: any = {
          name: values.productName,
          category: values.category,
          stock: values.stock,
          tags: values.tags || '',
          description: values.description,
          location: values.location,
          deliveryOptions: values.deliveryOptions,
          sellerId: user.uid,
          imageUrl: imageUrls[0] || '',
          videoUrl: videoUrls[0] || '',
          imageUrls: imageUrls,
          videoUrls: videoUrls,
          uploadDate: serverTimestamp(),
      };

      if (values.enableDiscount && values.salePrice && values.salePrice < values.price) {
          productData.price = values.salePrice;
          productData.wasPrice = values.price;
      } else {
          productData.price = values.price;
          productData.wasPrice = null;
      }

      const productsCollectionRef = collection(firestore, 'products');
      addDoc(productsCollectionRef, productData).catch(error => {
          const permissionError = new FirestorePermissionError({
              path: productsCollectionRef.path,
              operation: 'create',
              requestResourceData: productData
          });
          errorEmitter.emit('permission-error', permissionError);
      });

      toast({ title: 'Success!', description: 'Your product has been published with Cloudinary media.' });
      form.reset();
      setFiles([]);
      setUploadProgress({});

    } catch (error) {
        console.error('Error during product submission:', error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload your media. Please try again.' });
    } finally {
      setIsUploading(false);
    }
  };
  
  const enableDiscount = form.watch('enableDiscount');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Add New Product</CardTitle>
            <CardDescription>Upload media to Cloudinary and fill in the details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Media Upload Section */}
            <div>
              <FormLabel>Media (Images & Videos)</FormLabel>
              <div className="mt-2 flex justify-center rounded-lg border border-dashed border-input px-6 py-10">
                <div className="text-center">
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4 flex text-sm leading-6 text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md bg-background font-semibold text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 hover:text-primary/80"
                    >
                      <span>Upload files</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept="image/*,video/*" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF, MP4, MOV up to 100MB</p>
                </div>
              </div>
            </div>

            {/* Preview Gallery Section */}
            {files.length > 0 && (
              <div className="space-y-4">
                <FormLabel>Uploaded Media Preview</FormLabel>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {files.map((file) => (
                    <div key={file.name} className="relative group aspect-square rounded-md overflow-hidden border">
                      {file.type.startsWith('image/') ? (
                        <Image src={URL.createObjectURL(file)} alt={file.name} fill className="object-cover" />
                      ) : (
                        <video src={URL.createObjectURL(file)} className="h-full w-full object-cover" muted loop autoPlay />
                      )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" onClick={() => handleFileRemove(file.name)}><Trash2 size={16} /></Button>
                        </div>
                      {isUploading && uploadProgress[file.name] !== undefined && (
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                           <Progress value={uploadProgress[file.name]} className="h-2 bg-white/30 backdrop-blur-sm" />
                           <p className="text-xs text-white text-center mt-1">{Math.round(uploadProgress[file.name])}%</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product Information Section */}
            <div className="space-y-6 pt-8 border-t">
               <h3 className="text-lg font-medium leading-6 text-foreground">Product Information</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Apparel" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
               </div>
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description / Features</FormLabel>
                        <FormControl>
                            <Textarea rows={4} placeholder="Describe your product..." {...field} />
                        </FormControl>
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
                        <FormControl>
                            <Input placeholder="e.g., #summer, #tshirt, #fashion" {...field} />
                        </FormControl>
                         <FormDescription>Separate tags with commas.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            {/* Pricing & Inventory Section */}
            <div className="space-y-6 pt-8 border-t">
                <h3 className="text-lg font-medium leading-6 text-foreground">Pricing & Inventory</h3>
                 <FormField
                    control={form.control}
                    name="enableDiscount"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Enable Discount</FormLabel>
                                <FormDescription>
                                Create a sale by setting a lower sale price.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                    />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Original Price</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="e.g., 1500" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="salePrice"
                        render={({ field }) => (
                        <FormItem className={!enableDiscount ? 'hidden' : ''}>
                            <FormLabel>Sale Price</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="e.g., 1200" {...field} />
                            </FormControl>
                             <FormDescription>Must be lower than original price.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="stock"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Stock Quantity</FormLabel>
                            <FormControl>
                            <Input type="number" placeholder="e.g., 50" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Logistics Section */}
            <div className="space-y-6 pt-8 border-t">
                <h3 className="text-lg font-medium leading-6 text-foreground">Logistics & Delivery</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Product Location</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Nairobi CBD, Kenya" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="deliveryOptions"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery Options</FormLabel>
                        <FormControl>
                            <Textarea rows={3} placeholder="e.g., Same-day delivery within Nairobi for KES 300." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline">Save as Draft</Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? 'Publishing...' : 'Publish Product'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
