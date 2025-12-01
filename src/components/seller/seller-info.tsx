
'use client';

import type { Seller } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Truck, Shield, Info } from 'lucide-react';

interface SellerInfoProps {
  seller: Seller;
}

export function SellerInfo({ seller }: SellerInfoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
        {/* Left Column: About & Policies */}
        <div className="md:col-span-2">
            <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Info /> About Seller</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none text-neutral-300">
                    <p>{seller.bio || "This seller hasn't written a bio yet."}</p>
                </CardContent>
            </Card>

            <Card className="mt-6 bg-neutral-900 border-neutral-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Shield /> Shop Policies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-neutral-300">
                   <div>
                       <h4 className="font-semibold text-white">Return Policy</h4>
                       <p className="text-sm">{seller.returnPolicy || 'Not specified'}</p>
                   </div>
                   <div>
                       <h4 className="font-semibold text-white">Delivery Info</h4>
                       <p className="text-sm">{seller.deliveryPolicy || 'Not specified'}</p>
                   </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Key Details */}
        <div className="space-y-4">
            <Card className="bg-neutral-900 border-neutral-800">
                 <CardHeader>
                    <CardTitle className="text-lg">Store Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-neutral-300">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 mt-0.5 text-neutral-400" />
                        <div>
                            <h5 className="font-semibold text-white">Location</h5>
                            <span>{seller.location || 'Not specified'}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 mt-0.5 text-neutral-400" />
                        <div>
                            <h5 className="font-semibold text-white">Working Hours</h5>
                            <span>{seller.storeHours || 'Not specified'}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <Truck className="h-5 w-5 mt-0.5 text-neutral-400" />
                        <div>
                            <h5 className="font-semibold text-white">Joined</h5>
                            <span>{seller.joinedDate ? new Date(seller.joinedDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
