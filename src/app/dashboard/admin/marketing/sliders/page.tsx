
'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { HomepageSlide } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Pencil, Trash2, Loader2, UploadCloud } from 'lucide-react';
import Image from 'next/image';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';


const slideFormSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  imageUrl: z.string().url('A valid image URL is required.'),
  href: z.string().min(1, 'Link is required (e.g., /categories/fashion).'),
  order: z.coerce.number().int().min(0, 'Order must be a positive number.'),
});


const SlideForm = ({ slide, onFormSubmit }: { slide?: HomepageSlide, onFormSubmit: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const form = useForm<z.infer<typeof slideFormSchema>>({
        resolver: zodResolver(slideFormSchema),
        defaultValues: {
            title: slide?.title || '',
            description: slide?.description || '',
            imageUrl: slide?.imageUrl || '',
            href: slide?.href || '',
            order: slide?.order || 0,
        },
    });
    
    const imageUrl = form.watch('imageUrl');

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        toast({ title: 'Uploading image...', description: 'Please wait.' });

        try {
            const timestamp = Math.round((new Date()).getTime() / 1000);
            const paramsToSign = { timestamp, folder: 'homepage-sliders' };

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
            formData.append('folder', 'homepage-sliders');
            
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
            const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

            const response = await fetch(uploadUrl, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('Upload failed.');
            
            const uploadedData = await response.json();
            form.setValue('imageUrl', uploadedData.secure_url);
            toast({ title: 'Image Uploaded!' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not upload your image.' });
        } finally {
            setIsSaving(false);
        }
    };


    async function onSubmit(values: z.infer<typeof slideFormSchema>) {
        if (!firestore) return;
        setIsSaving(true);

        try {
            if (slide) {
                const slideRef = doc(firestore, 'homepageSlides', slide.id);
                await updateDoc(slideRef, values);
                toast({ title: 'Slide Updated' });
            } else {
                await addDoc(collection(firestore, 'homepageSlides'), values);
                toast({ title: 'Slide Created' });
            }
            onFormSubmit();
        } catch (error) {
            console.error('Error saving slide:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save slide.' });
        } finally {
            setIsSaving(false);
        }
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Image URL</FormLabel>
                        <FormControl><Input {...field} readOnly placeholder="Upload an image to get a URL" /></FormControl>
                        <FormMessage />
                    </FormItem>
                 )} />
                 <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                 <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                     <UploadCloud className="mr-2 h-4 w-4"/>
                     {isSaving ? 'Uploading...' : 'Upload Image'}
                 </Button>
                 {imageUrl && <Image src={imageUrl} alt="Preview" width={400} height={200} className="rounded-md object-cover aspect-video" />}

                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="href" render={({ field }) => (
                        <FormItem><FormLabel>Link URL</FormLabel><FormControl><Input placeholder="/categories/fashion" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="order" render={({ field }) => (
                        <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                 </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Slide'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
};


export default function AdminSlidersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedSlide, setSelectedSlide] = React.useState<HomepageSlide | undefined>(undefined);

  const slidesQuery = useMemoFirebase(() => query(collection(firestore, 'homepageSlides'), orderBy('order')), [firestore]);
  const { data: slides, isLoading } = useCollection<HomepageSlide>(slidesQuery);

  const handleDelete = async (slideId: string) => {
    if (!firestore) return;
    const slideRef = doc(firestore, 'homepageSlides', slideId);
    try {
        await deleteDoc(slideRef);
        toast({ title: 'Slide Deleted' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete slide.' });
    }
  };

  const columns: ColumnDef<HomepageSlide>[] = [
    { 
        accessorKey: 'imageUrl',
        header: 'Image',
        cell: ({ row }) => <Image src={row.original.imageUrl} alt={row.original.title} width={120} height={60} className="rounded-md object-cover aspect-video" />
    },
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'href', header: 'Link' },
    { accessorKey: 'order', header: 'Order' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedSlide(row.original); setIsFormOpen(true); }}>
                <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row.original.id)}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: slides || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                Marketing & Growth: Homepage Sliders
            </h1>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => setSelectedSlide(undefined)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Slide
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{selectedSlide ? 'Edit Slide' : 'Create New Slide'}</DialogTitle>
                    </DialogHeader>
                    <SlideForm slide={selectedSlide} onFormSubmit={() => setIsFormOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">Loading slides...</TableCell></TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No slides found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
