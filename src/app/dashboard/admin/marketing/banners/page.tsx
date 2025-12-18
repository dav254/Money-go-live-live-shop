
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
import { PlusCircle, Pencil, Trash2, UploadCloud } from 'lucide-react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

// Using a simplified type for the frontend mock, based on HomepageSlide
interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  href: string;
  description?: string;
  status: 'published' | 'draft';
}

const mockBanners: Banner[] = [
  {
    id: 'banner-1',
    title: 'Summer Fashion Drop',
    description: 'Discover the latest trends for the summer season.',
    imageUrl: 'https://picsum.photos/seed/banner1/150/100',
    href: '/category/summer-fashion',
    status: 'published',
  },
  {
    id: 'banner-2',
    title: 'Tech Gadgets Sale',
    description: 'Up to 30% off on smartphones and accessories.',
    imageUrl: 'https://picsum.photos/seed/banner2/150/100',
    href: '/sales/tech',
    status: 'published',
  },
  {
    id: 'banner-3',
    title: 'New Home Decor',
    description: 'Transform your living space.',
    imageUrl: 'https://picsum.photos/seed/banner3/150/100',
    href: '/category/home-decor',
    status: 'draft',
  },
];


const BannerForm = ({ banner, onSave, onCancel }: { banner?: Banner | null, onSave: (banner: Banner) => void, onCancel: () => void }) => {
    const [title, setTitle] = React.useState(banner?.title || '');
    const [description, setDescription] = React.useState(banner?.description || '');
    const [imageUrl, setImageUrl] = React.useState(banner?.imageUrl || '');
    const [href, setHref] = React.useState(banner?.href || '');
    const [status, setStatus] = React.useState(banner?.status === 'published' || false);
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !imageUrl || !href) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title, Image URL, and Link URL are required.' });
            return;
        }
        onSave({
            id: banner?.id || `banner-${Date.now()}`,
            title,
            description,
            imageUrl,
            href,
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
             <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="status-switch" className="flex flex-col space-y-1">
                    <span>Published</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                        Make this banner visible.
                    </span>
                </Label>
                <Switch id="status-switch" checked={status} onCheckedChange={setStatus} />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit">Save Banner</Button>
            </DialogFooter>
        </form>
    );
};


export default function AdminBannersPage() {
  const [banners, setBanners] = React.useState<Banner[]>(mockBanners);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingBanner, setEditingBanner] = React.useState<Banner | null>(null);
  const { toast } = useToast();

  const handleSave = (banner: Banner) => {
    setBanners(prev => {
        const exists = prev.find(s => s.id === banner.id);
        if (exists) {
            return prev.map(s => s.id === banner.id ? banner : s);
        }
        return [...prev, banner];
    });
    toast({ title: 'Success', description: `Banner "${banner.title}" has been saved.` });
    setIsFormOpen(false);
    setEditingBanner(null);
  };
  
  const handleDelete = (bannerId: string) => {
    setBanners(prev => prev.filter(s => s.id !== bannerId));
    toast({ title: 'Banner Deleted' });
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
