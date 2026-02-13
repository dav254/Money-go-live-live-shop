'use client';

import type { Seller } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Truck, Shield, Info, Mail, Phone, MessageSquare, Facebook, Instagram, Twitter } from 'lucide-react';
import { Button } from '../ui/button';

interface SellerInfoProps {
  seller: Seller;
}

export function SellerInfo({ seller }: SellerInfoProps) {
  const hasSocial = seller.facebookUrl || seller.instagramUrl || seller.twitterUrl;
  const hasContact = seller.contactEmail || seller.contactPhone || seller.contactWhatsapp;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
        {/* Left Column: About & Policies */}
        <div className="md:col-span-2 space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl"><Info /> About Seller</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none text-neutral-300">
                    <p>{seller.bio || "This seller hasn't written a bio yet."}</p>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
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

        {/* Right Column: Contact & Details */}
        <div className="space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
                 <CardHeader>
                    <CardTitle className="text-lg">Contact Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {hasContact ? (
                        <div className="space-y-3">
                            {seller.contactEmail && (
                                <div className="flex items-center gap-3 text-sm text-neutral-300">
                                    <Mail className="h-4 w-4 text-primary" />
                                    <span className="truncate">{seller.contactEmail}</span>
                                </div>
                            )}
                            {seller.contactPhone && (
                                <div className="flex items-center gap-3 text-sm text-neutral-300">
                                    <Phone className="h-4 w-4 text-primary" />
                                    <span>{seller.contactPhone}</span>
                                </div>
                            )}
                            {seller.contactWhatsapp && (
                                <Button asChild variant="outline" size="sm" className="w-full border-green-500/50 text-green-400 hover:bg-green-500/10">
                                    <a href={`https://wa.me/${seller.contactWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        WhatsApp Us
                                    </a>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-500">No contact info provided.</p>
                    )}

                    <Separator className="bg-neutral-800" />

                    {hasSocial && (
                        <div className="space-y-3 pt-2">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Follow Us</h5>
                            <div className="flex flex-wrap gap-2">
                                {seller.facebookUrl && (
                                    <a href={seller.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-neutral-800 hover:bg-blue-600 transition-colors">
                                        <Facebook className="h-4 w-4" />
                                    </a>
                                )}
                                {seller.instagramUrl && (
                                    <a href={seller.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-neutral-800 hover:bg-pink-600 transition-colors">
                                        <Instagram className="h-4 w-4" />
                                    </a>
                                )}
                                {seller.twitterUrl && (
                                    <a href={seller.twitterUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-neutral-800 hover:bg-sky-500 transition-colors">
                                        <Twitter className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
                 <CardHeader>
                    <CardTitle className="text-lg">Store Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-neutral-300">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 mt-0.5 text-neutral-400" />
                        <div>
                            <h5 className="font-semibold text-white">Location</h5>
                            <span className="text-sm">{seller.location || 'Not specified'}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 mt-0.5 text-neutral-400" />
                        <div>
                            <h5 className="font-semibold text-white">Working Hours</h5>
                            <span className="text-sm">{seller.storeHours || 'Not specified'}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <Truck className="h-5 w-5 mt-0.5 text-neutral-400" />
                        <div>
                            <h5 className="font-semibold text-white">Joined</h5>
                            <span className="text-sm">{seller.joinedDate ? new Date(seller.joinedDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
