
'use client';

import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useParams } from 'next/navigation';
import type { Order, UserProfile, SellerShop } from '@/lib/types';
import { MainLayout } from '@/components/layout/main-layout';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import React from 'react';

function InvoiceSkeleton() {
    return (
        <div className="max-w-4xl mx-auto p-8">
            <Card className="shadow-lg p-8 space-y-8">
                <Skeleton className="h-12 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="text-right">
                        <Skeleton className="h-4 w-48 ml-auto" />
                        <Skeleton className="h-4 w-48 ml-auto mt-2" />
                    </div>
                </div>
                <Skeleton className="h-32 w-full" />
                <div className="flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-6 w-full mt-2" />
                    </div>
                </div>
            </Card>
        </div>
    );
}


export default function InvoiceViewPage() {
    const params = useParams();
    const orderId = (params?.orderId as string) || '';
    const firestore = useFirestore();

    const orderRef = useMemoFirebase(() => doc(firestore, 'orders', orderId), [firestore, orderId]);
    const { data: order, isLoading: isOrderLoading, error: orderError } = useDoc<Order>(orderRef);

    const buyerRef = useMemoFirebase(() => order ? doc(firestore, 'userProfiles', order.buyerId) : null, [firestore, order]);
    const sellerShopRef = useMemoFirebase(() => order ? doc(firestore, 'sellerShops', order.sellerId) : null, [firestore, order]);

    const { data: buyer } = useDoc<UserProfile>(buyerRef);
    const { data: sellerShop } = useDoc<SellerShop>(sellerShopRef);

    const isLoading = isOrderLoading;

    const handlePrint = () => {
        window.print();
    };
    
    // Download PDF is a placeholder for now
    const handleDownload = () => {
       alert("PDF download feature coming soon!");
    };


    if (isLoading) {
        return <MainLayout><InvoiceSkeleton /></MainLayout>;
    }

    if (orderError || !order) {
        return (
            <MainLayout>
                <div className="text-center py-12">
                    <h1 className="text-2xl font-bold">Invoice Not Found</h1>
                    <p className="text-muted-foreground">The requested invoice does not exist or you do not have permission to view it.</p>
                </div>
            </MainLayout>
        );
    }
    
    const subtotal = order.productPrice || 0;
    const shipping = order.shippingCost || 0;
    const total = order.totalAmount;
    const platformFee = order.platformFee || 0;
    const resellerCommission = order.resellerCommission || 0;
    const netForSeller = total - platformFee - resellerCommission;

    return (
        <MainLayout>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #invoice-print-area, #invoice-print-area * { visibility: visible; }
                    #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none !important; }
                    @page { size: auto; margin: 0mm; }
                }
            `}</style>
             <div className="bg-muted/40 py-8 px-4">
                <div id="invoice-print-area" className="max-w-4xl mx-auto">
                    <Card className="shadow-lg p-8 sm:p-12">
                         <div className="flex justify-between items-center mb-8 no-print">
                            <h1 className="text-2xl font-bold">Invoice</h1>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                            </div>
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <Logo className="text-4xl text-primary" />
                                <h1 className="text-3xl font-bold mt-4">INVOICE</h1>
                                <p className="text-muted-foreground"># {order.id}</p>
                            </div>
                            <div className="text-right">
                                <h2 className="text-xl font-semibold">{sellerShop?.shopName || 'Seller'}</h2>
                            </div>
                        </div>
                        <Separator className="my-8" />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-semibold">BILL TO</h3>
                                <p className="font-bold">{buyer?.fullName}</p>
                                <p className="text-muted-foreground whitespace-pre-line">{order.shippingAddress}</p>
                            </div>
                            <div className="text-right">
                                <p><span className="font-semibold">Issue Date:</span> {order.orderDate.toDate().toLocaleDateString()}</p>
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
                                    <tr className="border-b">
                                        <td className="py-2">{order.productName}</td>
                                        <td className="text-center py-2">{order.quantity}</td>
                                        <td className="text-right py-2">${subtotal.toFixed(2)}</td>
                                        <td className="text-right py-2">${(order.quantity || 1 * subtotal).toFixed(2)}</td>
                                    </tr>
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
                                <div className="flex justify-between text-sm"><span>Platform Fee</span><span className="text-destructive">-${platformFee.toFixed(2)}</span></div>
                                {resellerCommission > 0 && <div className="flex justify-between text-sm"><span>Reseller Commission</span><span className="text-destructive">-${resellerCommission.toFixed(2)}</span></div>}
                                <div className="flex justify-between font-bold text-lg"><span>Net Amount for Seller</span><span className="text-primary">${netForSeller.toFixed(2)}</span></div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
