
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
import { useAuth, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  const storage = getStorage();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      category: '',
      price: 0,
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
      setFiles((prev) => [...prev, ...newFiles].slice(0, 1)); // Limit to one file for now
    }
  };

  const handleFileRemove = (fileName: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== fileName));
  };
  
  const uploadFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!user) {
        reject('User not authenticated');
        return;
      }
      const storageRef = ref(storage, `products/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
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

    try {
        const fileUrl = await uploadFile(files[0]);
        
        const productData = {
            ...values,
            sellerId: user.uid,
            imageUrl: fileUrl,
            videoUrl: '', // Add video logic later
            uploadDate: serverTimestamp(),
            wasPrice: values.enableDiscount ? values.price : null,
            price: values.enableDiscount && values.salePrice ? values.salePrice : values.price,
        };

        const docRef = await addDoc(collection(firestore, 'products'), productData);
        
        toast({ title: 'Success!', description: 'Your product has been published.' });
        form.reset();
        setFiles([]);
        setUploadProgress({});

    } catch (error) {
        console.error("Error uploading product:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'There was an error saving your product.' });
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
            <CardDescription>Upload media and fill in the details for your new product.</CardDescription>
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
                  <p className="text-xs leading-5 text-gray-500">PNG, JPG, GIF, MP4, MOV up to 50MB</p>
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
                        <video src={URL.createObjectURL(file)} className="h-full w-full object-cover" />
                      )}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 hover:text-white"><Pencil size={16} /></Button>
                            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 hover:text-white" onClick={() => handleFileRemove(file.name)}><Trash2 size={16} /></Button>
                        </div>
                      {uploadProgress[file.name] !== undefined && uploadProgress[file.name] < 100 && (
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                           <Progress value={uploadProgress[file.name]} className="h-2" />
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
                 <div>
                    <Button type="button" variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> Add Variation (Color, Size)</Button>
                </div>
            </div>

            {/* Pricing & Inventory Section */}
            <div className="space-y-6 pt-8 border-t">
                <h3 className="text-lg font-medium leading-6 text-foreground">Pricing & Discounts</h3>
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
                 {enableDiscount && (
                    <Card className="bg-primary/10 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base text-primary">
                        <Sparkles className="h-5 w-5" />
                        AI-Powered Discount (Optional)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                        Let AI suggest the optimal sale price based on market trends and your sales history to maximize profit.
                        </p>
                        <Button type="button" variant="secondary">
                        Suggest Discount
                        </Button>
                    </CardContent>
                    </Card>
                )}
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
                            <Textarea rows={3} placeholder="e.g., Same-day delivery within Nairobi for KES 300. Nationwide delivery via G4S (2-3 days)." {...field} />
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
              {isUploading ? 'Uploading...' : 'Publish Product'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
