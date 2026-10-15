'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
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
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Pencil, Trash2, GripVertical } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { HomepageSlide } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const SlideForm = ({ slide, onSave, onCancel }: { slide?: HomepageSlide | null, onSave: (slide: Partial<HomepageSlide>) => void, onCancel: () => void }) => {
    const [title, setTitle] = React.useState(slide?.title || '');
    const [description, setDescription] = React.useState(slide?.description || '');
    const [imageUrl, setImageUrl] = React.useState(slide?.imageUrl || '');
    const [imageHint, setImageHint] = React.useState(slide?.imageHint || '');
    const [href, setHref] = React.useState(slide?.href || '');
    const [order, setOrder] = React.useState(slide?.order || 0);
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !imageUrl || !href) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title, Image URL, and Link URL are required.' });
            return;
        }
        onSave({
            id: slide?.id,
            title,
            description,
            imageUrl,
            imageHint,
            href,
            order,
        });
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Summer Sale" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A short, catchy description for the slide." />
            </div>
            <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="/uploads/slide.jpg" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="imageHint">Image Hint (for AI)</Label>
                <Input id="imageHint" value={imageHint} onChange={e => setImageHint(e.target.value)} placeholder="e.g., summer fashion" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="href">Link URL</Label>
                <Input id="href" value={href} onChange={e => setHref(e.target.value)} placeholder="/category/sales" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="order">Display Order</Label>
                <Input id="order" type="number" value={order} onChange={e => setOrder(Number(e.target.value))} />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></DialogClose>
                <Button type="submit">Save Slide</Button>
            </DialogFooter>
        </form>
    );
};


export default function AdminSlidersPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingSlide, setEditingSlide] = React.useState<HomepageSlide | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const slidesQuery = useMemoFirebase(() => query(collection(firestore, 'homepageSlides'), orderBy('order')), [firestore]);
  const { data: slides, isLoading } = useCollection<HomepageSlide>(slidesQuery);

  const handleSave = async (slideData: Partial<HomepageSlide>) => {
      if (!firestore) return;
      
      const { id, ...data } = slideData;

      try {
        if (id) {
          const slideRef = doc(firestore, 'homepageSlides', id);
          await updateDoc(slideRef, data);
          toast({ title: 'Success', description: `Slide "${data.title}" has been updated.` });
        } else {
          await addDoc(collection(firestore, 'homepageSlides'), data);
          toast({ title: 'Success', description: `Slide "${data.title}" has been created.` });
        }
        setIsFormOpen(false);
        setEditingSlide(null);
      } catch (error) {
        console.error("Error saving slide:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the slide.' });
      }
  };
  
  const handleDelete = async (slideId: string) => {
    if (!firestore) return;
    const slideRef = doc(firestore, 'homepageSlides', slideId);
    try {
        await deleteDoc(slideRef);
        toast({ title: 'Slide Deleted' });
    } catch (error) {
        console.error("Error deleting slide:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the slide.' });
    }
  };
  
  const handleEdit = (slide: HomepageSlide) => {
    setEditingSlide(slide);
    setIsFormOpen(true);
  }

  const columns: ColumnDef<HomepageSlide>[] = [
    {
      accessorKey: 'order',
      header: 'Order',
       cell: ({ row }) => <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /> {row.original.order}</div>
    },
    {
      accessorKey: 'title',
      header: 'Slide',
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <Image src={row.original.imageUrl} alt={row.original.title || 'Homepage Slide'} width={80} height={45} className="rounded-md object-cover" />
          <div className="font-medium">{row.original.title}</div>
        </div>
      ),
    },
    {
      accessorKey: 'href',
      header: 'Link',
      cell: ({ row }) => <p className="text-sm text-muted-foreground truncate">{row.original.href}</p>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(row.original)}>
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
            Marketing: Homepage Sliders
          </h1>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setEditingSlide(null)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Slide
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{editingSlide ? 'Edit Slide' : 'Create New Slide'}</DialogTitle>
                </DialogHeader>
                <SlideForm 
                    slide={editingSlide}
                    onSave={handleSave}
                    onCancel={() => setIsFormOpen(false)}
                />
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
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        Loading sliders...
                    </TableCell>
                  </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No homepage slides created yet.
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
