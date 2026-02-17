'use client';

import type { Seller } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Truck, Shield, Info, Mail, Phone, MessageSquare, Facebook, Instagram, Twitter } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '@/components/ui/separator';

interface SellerInfoProps {
  seller: Seller;
}

export function SellerInfo({ seller }: SellerInfoProps) {
  const hasSocial = seller.facebookUrl || seller.instagramUrl || seller.twitterUrl;
  const hasContact = seller.contactEmail || seller.contactPhone || seller.contactWhatsapp;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white pb-12">
        {/* Left Column: About & Policies */}
        <div className="md:col-span-2 space-y-6">
            <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline uppercase tracking-tight"><Info className="text-primary" /> About Seller</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none text-neutral-300">
                    <p className="leading-relaxed">{seller.bio || "This seller hasn't written a bio yet."}</p>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-headline uppercase tracking-tight"><Shield className="text-primary" /> Shop Policies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-neutral-300">
                   <div>
                       <h4 className="font-black text-white uppercase text-xs tracking-widest mb-2">Return Policy</h4>
                       <p className="text-sm border-l-2 border-primary/20 pl-4 py-1">{seller.returnPolicy || 'We follow standard platform return guidelines.'}</p>
                   </div>
                   <div>
                       <h4 className="font-black text-white uppercase text-xs tracking-widest mb-2">Delivery Info</h4>
                       <p className="text-sm border-l-2 border-primary/20 pl-4 py-1">{seller.deliveryPolicy || 'Shipping details are available at checkout.'}</p>
                   </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column: Contact & Details */}
        <div className="space-y-6">
            <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                 <CardHeader>
                    <CardTitle className="text-lg font-headline uppercase tracking-widest">Connect with Us</CardTitle>
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
                                <Button asChild variant="outline" size="sm" className="w-full border-green-500/50 text-green-400 hover:bg-green-500/10 font-bold uppercase tracking-widest text-[10px] h-10">
                                    <a href={`https://wa.me/${seller.contactWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        WhatsApp Chat
                                    </a>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No contact info provided.</p>
                    )}

                    {hasSocial && (
                        <>
                            <Separator className="bg-neutral-800" />
                            <div className="space-y-3 pt-2">
                                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Official Socials</h5>
                                <div className="flex flex-wrap gap-2">
                                    {seller.facebookUrl && (
                                        <a href={seller.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-neutral-800 hover:bg-blue-600 transition-all transform hover:scale-110">
                                            <Facebook className="h-4 w-4" />
                                        </a>
                                    )}
                                    {seller.instagramUrl && (
                                        <a href={seller.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-neutral-800 hover:bg-pink-600 transition-all transform hover:scale-110">
                                            <Instagram className="h-4 w-4" />
                                        </a>
                                    )}
                                    {seller.twitterUrl && (
                                        <a href={seller.twitterUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-neutral-800 hover:bg-sky-500 transition-all transform hover:scale-110">
                                            <Twitter className="h-4 w-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800">
                 <CardHeader>
                    <CardTitle className="text-lg font-headline uppercase tracking-widest">Business Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-neutral-300">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                        <div>
                            <h5 className="font-bold text-white text-xs uppercase tracking-widest">Location</h5>
                            <span className="text-sm">{seller.location || 'Global Seller'}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 mt-0.5 text-primary" />
                        <div>
                            <h5 className="font-bold text-white text-xs uppercase tracking-widest">Hours</h5>
                            <span className="text-sm">{seller.storeHours || 'Online 24/7'}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-3">
                        <Truck className="h-5 w-5 mt-0.5 text-primary" />
                        <div>
                            <h5 className="font-bold text-white text-xs uppercase tracking-widest">Member Since</h5>
                            <span className="text-sm">{seller.joinedDate ? new Date(seller.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric'}) : 'N/A'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
