
'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/dashboard/date-picker';
import { Separator } from '@/components/ui/separator';
import { Trash2, PlusCircle, Printer, Send } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import type { Order, UserProfile } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
});

const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required.'),
  issueDate: z.date(),
  dueDate: z.date(),
  billToName: z.string().min(1, 'Buyer name is required.'),
  billToAddress: z.string().min(1, 'Buyer address is required.'),
  sellerName: z.string().min(1, 'Seller name is required.'),
  sellerAddress: z.string().min(1, 'Seller address is required.'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required.'),
  notes: z.string().optional(),
  shippingCost: z.coerce.number().optional().default(0),
});

export default function AdminInvoiceGeneratorPage() {
  const firestore = useFirestore();
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  
  const ordersQuery = useMemoFirebase(() => query(collection(firestore, 'orders'), orderBy('orderDate', 'desc')), [firestore]);
  const { data: orders, isLoading: areOrdersLoading } = useCollection<Order>(ordersQuery);

  const selectedOrder = React.useMemo(() => orders?.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  const buyerProfileRef = useMemoFirebase(() => {
    if (!selectedOrder?.buyerId) return null;
    return doc(firestore, 'userProfiles', selectedOrder.buyerId);
  }, [firestore, selectedOrder]);
  
  const { data: buyerProfile } = useDoc<UserProfile>(buyerProfileRef);

  const form = useForm<z.infer<typeof invoiceFormSchema>>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      issueDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      billToName: '',
      billToAddress: '',
      sellerName: 'Go Earn Platform',
      sellerAddress: 'Nairobi, Kenya',
      items: [{ description: '', quantity: 1, price: 0 }],
      notes: 'Thank you for your business!',
      shippingCost: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  
  // Effect to auto-fill form when an order is selected
  React.useEffect(() => {
    if (selectedOrder && buyerProfile) {
      form.reset({
        invoiceNumber: selectedOrder.id,
        issueDate: selectedOrder.orderDate.toDate(),
        dueDate: new Date(selectedOrder.orderDate.toDate().setDate(selectedOrder.orderDate.toDate().getDate() + 30)),
        billToName: buyerProfile.fullName,
        billToAddress: selectedOrder.shippingAddress,
        items: [{
          description: selectedOrder.productName || 'Product',
          quantity: selectedOrder.quantity || 1,
          price: selectedOrder.productPrice || 0,
        }],
        shippingCost: selectedOrder.shippingCost || 0,
        notes: 'Thank you for your business!',
        sellerName: 'Go Earn Platform',
        sellerAddress: 'Nairobi, Kenya',
      })
    }
  }, [selectedOrder, buyerProfile, form]);


  const watchAllFields = form.watch();

  const subtotal = React.useMemo(() => {
    return watchAllFields.items?.reduce((acc, item) => acc + (item.quantity || 0) * (item.price || 0), 0) || 0;
  }, [watchAllFields.items]);

  const shipping = watchAllFields.shippingCost || 0;
  const platformFee = (subtotal + shipping) * 0.10; // 10% platform fee
  const total = subtotal + shipping;
  const netForSeller = total - platformFee;

  const handlePrint = () => {
    window.print();
  }

  return (
    <AdminLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #invoice-preview, #invoice-preview * {
                visibility: visible;
              }
              #invoice-preview {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              @page {
                size: auto;
                margin: 0mm;
              }
            }
        `}</style>
        <div className="flex items-center justify-between">
            <h1 className="font-headline text-3xl font-bold tracking-tight">
            Invoice Generator
            </h1>
            <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Invoice</Button>
                <Button><Send className="mr-2 h-4 w-4" /> Send Invoice to Seller</Button>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-2">
                <Form {...form}>
                    <form className="space-y-6">
                       <Card>
                          <CardHeader><CardTitle>Load from Order</CardTitle></CardHeader>
                          <CardContent>
                            <Select onValueChange={setSelectedOrderId} disabled={areOrdersLoading}>
                                <SelectTrigger>
                                  <SelectValue placeholder={areOrdersLoading ? "Loading orders..." : "Select an order to auto-fill"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {orders?.map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                      #{order.id.substring(0, 6)}... - {order.productName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                            </Select>
                          </CardContent>
                       </Card>

                        <Card>
                             <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
                             <CardContent className="space-y-4">
                                 <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Invoice #</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                 )} />
                                 <div className="grid grid-cols-2 gap-4">
                                     <FormField control={form.control} name="issueDate" render={({ field }) => (
                                        <FormItem><FormLabel>Issue Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                     )} />
                                     <FormField control={form.control} name="dueDate" render={({ field }) => (
                                        <FormItem><FormLabel>Due Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>
                                     )} />
                                 </div>
                             </CardContent>
                        </Card>
                        <Card>
                             <CardHeader><CardTitle>Parties</CardTitle></CardHeader>
                             <CardContent className="space-y-4">
                                <FormField control={form.control} name="billToName" render={({ field }) => (
                                    <FormItem><FormLabel>Bill To</FormLabel><FormControl><Input placeholder="Buyer Name" {...field} /></FormControl><FormMessage /></FormItem>
                                 )} />
                                 <FormField control={form.control} name="billToAddress" render={({ field }) => (
                                    <FormItem><FormControl><Textarea placeholder="Buyer Address" {...field} /></FormControl><FormMessage /></FormItem>
                                 )} />
                                  <Separator />
                                   <FormField control={form.control} name="sellerName" render={({ field }) => (
                                    <FormItem><FormLabel>From</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                 )} />
                                  <FormField control={form.control} name="sellerAddress" render={({ field }) => (
                                    <FormItem><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                 )} />
                             </CardContent>
                        </Card>
                         <Card>
                             <CardHeader><CardTitle>Items</CardTitle></CardHeader>
                             <CardContent className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-[1fr_80px_100px_40px] gap-2 items-start">
                                        <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                                            <FormItem><FormLabel className="sr-only">Desc</FormLabel><FormControl><Input placeholder="Item description" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                            <FormItem><FormLabel className="sr-only">Qty</FormLabel><FormControl><Input type="number" placeholder="Qty" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name={`items.${index}.price`} render={({ field }) => (
                                            <FormItem><FormLabel className="sr-only">Price</FormLabel><FormControl><Input type="number" placeholder="Price" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, price: 0 })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                                </Button>
                             </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                            <CardContent>
                                <FormField control={form.control} name="notes" render={({ field }) => (
                                    <FormItem><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    </form>
                </Form>
            </div>
            <div id="invoice-preview" className="lg:col-span-3">
                 <Card className="shadow-lg p-8">
                     <div className="flex justify-between items-start">
                        <div>
                            <Logo className="h-12 w-auto text-primary" />
                            <h1 className="text-3xl font-bold mt-4">INVOICE</h1>
                            <p className="text-muted-foreground"># {watchAllFields.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-semibold">{watchAllFields.sellerName}</h2>
                            <p className="text-muted-foreground whitespace-pre-line">{watchAllFields.sellerAddress}</p>
                        </div>
                     </div>
                     <Separator className="my-8" />
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-semibold">BILL TO</h3>
                            <p className="font-bold">{watchAllFields.billToName}</p>
                            <p className="text-muted-foreground whitespace-pre-line">{watchAllFields.billToAddress}</p>
                        </div>
                        <div className="text-right">
                            <p><span className="font-semibold">Issue Date:</span> {watchAllFields.issueDate?.toLocaleDateString()}</p>
                            <p><span className="font-semibold">Due Date:</span> {watchAllFields.dueDate?.toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className="mt-8">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 font-semibold">DESCRIPTION</th>
                                    <th className="text-center py-2 font-semibold">QTY</th>
                                    <th className="text-right py-2 font-semibold">UNIT PRICE</th>
                                    <th className="text-right py-2 font-semibold">TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchAllFields.items?.map((item, i) => (
                                    <tr key={i} className="border-b">
                                        <td className="py-2">{item.description}</td>
                                        <td className="text-center py-2">{item.quantity}</td>
                                        <td className="text-right py-2">${(item.price || 0).toFixed(2)}</td>
                                        <td className="text-right py-2">${((item.quantity || 0) * (item.price || 0)).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                     <div className="flex justify-end mt-8">
                        <div className="w-full max-w-sm space-y-2">
                             <div className="flex justify-between"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                             <div className="flex justify-between"><span>Shipping</span><span>${shipping.toFixed(2)}</span></div>
                             <Separator />
                             <div className="flex justify-between font-bold text-lg"><span>Total Paid by Buyer</span><span>${total.toFixed(2)}</span></div>
                              <Separator />
                              <div className="flex justify-between text-sm"><span>Platform Fee (10%)</span><span className="text-destructive">-${platformFee.toFixed(2)}</span></div>
                              <div className="flex justify-between font-bold text-lg"><span>Net Amount for Seller</span><span className="text-primary">${netForSeller.toFixed(2)}</span></div>
                        </div>
                     </div>
                     <div className="mt-8">
                        <h4 className="font-semibold">Notes</h4>
                        <p className="text-sm text-muted-foreground">{watchAllFields.notes}</p>
                     </div>
                 </Card>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
}
