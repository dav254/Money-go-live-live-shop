
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { HelpArticle } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Pencil, Trash2, Loader2 } from 'lucide-react';


const articleFormSchema = z.object({
  question: z.string().min(5, 'Question is required.'),
  answer: z.string().min(10, 'Answer is required.'),
  category: z.string().min(2, 'Category is required.'),
  audience: z.array(z.string()).min(1, 'At least one audience must be selected.'),
});


const ArticleForm = ({ article, onFormSubmit }: { article?: HelpArticle, onFormSubmit: () => void }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<z.infer<typeof articleFormSchema>>({
        resolver: zodResolver(articleFormSchema),
        defaultValues: {
            question: article?.question || '',
            answer: article?.answer || '',
            category: article?.category || '',
            audience: article?.audience || [],
        },
    });

    async function onSubmit(values: z.infer<typeof articleFormSchema>) {
        if (!firestore) return;
        setIsSaving(true);
        const data = { ...values, createdAt: serverTimestamp() };

        try {
            if (article) {
                const articleRef = doc(firestore, 'helpArticles', article.id);
                await updateDoc(articleRef, data);
                toast({ title: 'Article Updated' });
            } else {
                await addDoc(collection(firestore, 'helpArticles'), data);
                toast({ title: 'Article Created' });
            }
            onFormSubmit();
        } catch (error) {
            console.error('Error saving article:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save article.' });
        } finally {
            setIsSaving(false);
        }
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Question</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="answer"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Answer</FormLabel>
                            <FormControl><Textarea rows={6} {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category</FormLabel>
                                <FormControl><Input placeholder="e.g., Getting Started" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="audience"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Audience</FormLabel>
                                <FormControl>
                                   <Select onValueChange={(value) => field.onChange([value])} defaultValue={field.value?.[0]}>
                                        <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="buyer">Buyer</SelectItem>
                                            <SelectItem value="seller">Seller</SelectItem>
                                            <SelectItem value="reseller">Reseller</SelectItem>
                                        </SelectContent>
                                   </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Article'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
};


export default function AdminHelpCenterPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [selectedArticle, setSelectedArticle] = React.useState<HelpArticle | undefined>(undefined);

  const articlesQuery = useMemoFirebase(() => query(collection(firestore, 'helpArticles')), [firestore]);
  const { data: articles, isLoading } = useCollection<HelpArticle>(articlesQuery);

  const handleDelete = async (articleId: string) => {
    if (!firestore) return;
    const articleRef = doc(firestore, 'helpArticles', articleId);
    try {
        await deleteDoc(articleRef);
        toast({ title: 'Article Deleted' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete article.' });
    }
  };

  const columns: ColumnDef<HelpArticle>[] = [
    { accessorKey: 'question', header: 'Question' },
    { accessorKey: 'category', header: 'Category' },
    {
      accessorKey: 'audience',
      header: 'Audience',
      cell: ({ row }) => <p className="capitalize">{(row.original.audience || []).join(', ')}</p>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedArticle(row.original); setIsFormOpen(true); }}>
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
    data: articles || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
                Help Center Manager
            </h1>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => setSelectedArticle(undefined)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Article
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedArticle ? 'Edit Article' : 'Create New Article'}</DialogTitle>
                    </DialogHeader>
                    <ArticleForm article={selectedArticle} onFormSubmit={() => setIsFormOpen(false)} />
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
                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">Loading articles...</TableCell></TableRow>
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
                    No articles found.
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
