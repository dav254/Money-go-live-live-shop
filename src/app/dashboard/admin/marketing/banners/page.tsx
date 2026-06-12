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
import { PlusCircle, Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { HomepageSlide } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

// Using HomepageSlide as the type for a banner
type Banner = HomepageSlide & { status: 'published' | 'draft' };


const BannerForm = ({ banner, onSave, onCancel }: { banner?: Banner | null, onSave: (banner: Partial<Banner>) => void, onCancel: () => void }) => {
    const [title, setTitle] = React.useState(banner?.title || '');
    const [description, setDescription] = React.useState(banner?.description || '');
    const [imageUrl, setImageUrl] = React.useState(banner?.imageUrl || '');
    const [href, setHref] = React.useState(banner?.href || '');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !imageUrl || !href) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title, Image URL, and Link URL are required.' });
            return;
        }
        onSave({
            id: banner?.id, // Pass ID for updates
            title,
            description,
            imageUrl,
            href,
            // Assuming default order if not provided. In a real app, you'd manage this.
            order: banner?.order || 0,
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
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="A short, catchy description for the banner." />
            </div>
            <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="href">Link URL</Label>
                <Input id="href" value={href} onChange={e => setHref(e.target.value)} placeholder="/category/sales" />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button></DialogClose>
                <Button type="submit">Save Banner</Button>
            </DialogFooter>
        </form>
    );
};


export default function AdminBannersPage() {
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingBanner, setEditingBanner] = React.useState<Banner | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const slidesQuery = useMemoFirebase(() => query(collection(firestore, 'homepageSlides'), orderBy('order')), [firestore]);
  const { data: slides, isLoading } = useCollection<HomepageSlide>(slidesQuery);

  const banners = (slides as Banner[]) || [];

  const handleSave = async (bannerData: Partial<Banner>) => {
      if (!firestore) return;
      
      const { id, ...data } = bannerData;

      try {
        if (id) {
          // Update existing banner
          const bannerRef = doc(firestore, 'homepageSlides', id);
          await updateDoc(bannerRef, data);
          toast({ title: 'Success', description: `Banner "${data.title}" has been updated.` });
        } else {
          // Create new banner
          await addDoc(collection(firestore, 'homepageSlides'), data);
          toast({ title: 'Success', description: `Banner "${data.title}" has been created.` });
        }
        setIsFormOpen(false);
        setEditingBanner(null);
      } catch (error) {
        console.error("Error saving banner:", error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the banner.' });
      }
  };
  
  const handleDelete = async (bannerId: string) => {
    if (!firestore) return;
    const bannerRef = doc(firestore, 'homepageSlides', bannerId);
    try {
        await deleteDoc(bannerRef);
        toast({ title: 'Banner Deleted' });
    } catch (error) {
        console.error("Error deleting banner:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the banner.' });
    }
  };
  
  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setIsFormOpen(true);
  }

  const columns: ColumnDef<Banner>[] = [
    {
      accessorKey: 'title',
      header: 'Banner',
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <Image src={row.original.imageUrl} alt={row.original.title || 'Marketing Banner'} width={80} height={45} className="rounded-md object-cover" />
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
    data: banners,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="font-headline text-3xl font-bold tracking-tight">
            Marketing: Promo Banners
          </h1>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => setEditingBanner(null)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create Banner
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{editingBanner ? 'Edit Banner' : 'Create New Banner'}</DialogTitle>
                </DialogHeader>
                <BannerForm 
                    banner={editingBanner}
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
                        Loading banners...
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
                    No promotional banners found.
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
