
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
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
import { Switch } from '@/components/ui/switch';


// Using a simplified type for the frontend mock
interface Slide {
  id: string;
  order: number;
  title: string;
  imageUrl: string;
  href: string;
  description?: string;
  status: 'published' | 'draft';
}

const mockSlides: Slide[] = [
  {
    id: 'slide-1',
    order: 1,
    title: 'Summer Fashion Drop',
    description: 'Discover the latest trends for the summer season.',
    imageUrl: 'https://picsum.photos/seed/slide1/150/100',
    href: '/category/summer-fashion',
    status: 'published',
  },
  {
    id: 'slide-2',
    order: 2,
    title: 'Tech Gadgets Sale',
    description: 'Up to 30% off on smartphones and accessories.',
    imageUrl: 'https://picsum.photos/seed/slide2/150/100',
    href: '/sales/tech',
    status: 'published',
  },
  {
    id: 'slide-3',
    order: 3,
    title: 'New Home Decor',
    description: 'Transform your living space.',
    imageUrl: 'https://picsum.photos/seed/slide3/150/100',
    href: '/category/home-decor',
    status: 'draft',
  },
];


const SlideForm = ({ slide, onSave, onCancel }: { slide?: Slide | null, onSave: (slide: Slide) => void, onCancel: () => void }) => {
    const [title, setTitle] = React.useState(slide?.title || '');
    const [description, setDescription] = React.useState(slide?.description || '');
    const [imageUrl, setImageUrl] = React.useState(slide?.imageUrl || '');
    const [href, setHref] = React.useState(slide?.href || '');
    const [order, setOrder] = React.useState(slide?.order || 0);
    const [status, setStatus] = React.useState(slide?.status === 'published' || false);
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !imageUrl || !href) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title, Image URL, and Link URL are required.' });
            return;
        }
        onSave({
            id: slide?.id || `slide-${Date.now()}`,
            title,
            description,
            imageUrl,
            href,
            order,
            status: status ? 'published' : 'draft',
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
                <Input id="imageUrl" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="href">Link URL</Label>
                <Input id="href" value={href} onChange={e => setHref(e.target.value)} placeholder="/category/sales" />
            </div>
             <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="status-switch" className="flex flex-col space-y-1">
                    <span>Published</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Make this slide visible on the homepage.
                    </span>
                </Label>
                <Switch id="status-switch" checked={status} onCheckedChange={setStatus} />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit">Save Slide</Button>
            </DialogFooter>
        </form>
    );
};


export default function AdminSlidersPage() {
  const [slides, setSlides] = React.useState<Slide[]>(mockSlides);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'order', desc: false }]);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingSlide, setEditingSlide] = React.useState<Slide | null>(null);
  const { toast } = useToast();

  const handleSave = (slide: Slide) => {
    setSlides(prev => {
        const exists = prev.find(s => s.id === slide.id);
        let updatedSlides;
        if (exists) {
            updatedSlides = prev.map(s => s.id === slide.id ? slide : s);
        } else {
            updatedSlides = [...prev, slide];
        }
        return updatedSlides.sort((a, b) => a.order - b.order);
    });
    toast({ title: 'Success', description: `Slide "${slide.title}" has been saved.` });
    setIsFormOpen(false);
    setEditingSlide(null);
  };
  
  const handleDelete = (slideId: string) => {
    setSlides(prev => prev.filter(s => s.id !== slideId));
    toast({ title: 'Slide Deleted' });
  };
  
  const handleEdit = (slide: Slide) => {
    setEditingSlide(slide);
    setIsFormOpen(true);
  }

  const columns: ColumnDef<Slide>[] = [
    {
      id: 'order',
      accessorKey: 'order',
      header: 'Order',
       cell: ({ row }) => <div className="flex items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /> {row.original.order}</div>
    },
    {
      accessorKey: 'title',
      header: 'Slide',
      cell: ({ row }) => (
        <div className="flex items-center gap-4">
          <Image src={row.original.imageUrl} alt={row.original.title} width={80} height={45} className="rounded-md object-cover" />
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant={row.original.status === 'published' ? 'default' : 'secondary'} className={`capitalize ${row.original.status === 'published' ? 'bg-green-600/80' : ''}`}>{row.original.status}</Badge>,
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
    data: slides,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
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
              {table.getRowModel().rows?.length ? (
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

