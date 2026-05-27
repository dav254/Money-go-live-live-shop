
'use client';

import type { Seller } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Clock, Truck, Shield, Info, Mail, Phone, MessageSquare, Facebook, Instagram, Twitter, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '@/components/ui/separator';

interface SellerInfoProps {
  seller: Seller;
}

export function SellerInfo({ seller }: SellerInfoProps) {
  const hasSocial = seller.facebookUrl || seller.instagramUrl || seller.twitterUrl;
  const hasContact = seller.contactEmail || seller.contactPhone || seller.contactWhatsapp;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-white pb-12 animate-in fade-in duration-500">
        <div className="md:col-span-2 space-y-8">
            <Card className="bg-neutral-900 border-neutral-800 rounded-3xl shadow-2xl overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em]"><Info className="h-4 w-4 text-primary" /> Store Manifesto</CardTitle>
                </CardHeader>
                <CardContent className="p-8 prose prose-invert prose-sm max-w-none text-neutral-300">
                    <p className="leading-relaxed whitespace-pre-line text-base font-medium">
                        {seller.description || seller.bio || "Welcome to our official store. We prioritize quality and customer satisfaction in every order."}
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800 rounded-3xl shadow-2xl overflow-hidden">
                <CardHeader className="bg-white/5 border-b border-white/5">
                    <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em]"><Shield className="h-4 w-4 text-primary" /> Buyer Protections</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8 text-neutral-300">
                   <div className="space-y-3">
                       <h4 className="font-black text-white uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-primary" /> RETURN POLICY
                       </h4>
                       <p className="text-sm font-medium border-l-2 border-primary/20 pl-6 py-2 leading-relaxed bg-white/5 rounded-r-xl pr-4">
                           {seller.returnPolicy || '30-day standard returns accepted for unused items in original packaging.'}
                       </p>
                   </div>
                   <div className="space-y-3">
                       <h4 className="font-black text-white uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                           <div className="h-1.5 w-1.5 rounded-full bg-primary" /> FULFILLMENT PROMISE
                       </h4>
                       <p className="text-sm font-medium border-l-2 border-primary/20 pl-6 py-2 leading-relaxed bg-white/5 rounded-r-xl pr-4">
                           {seller.deliveryPolicy || 'We ship nationwide using verified couriers. Tracking information provided on dispatch.'}
                       </p>
                   </div>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-8">
            <Card className="bg-neutral-900 border-neutral-800 rounded-3xl shadow-2xl overflow-hidden relative">
                 <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                 <CardHeader className="bg-white/5 border-b border-white/5">
                     <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Contact & Support</CardTitle>
                 </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {hasContact ? (
                        <div className="space-y-5">
                            {seller.contactEmail && (
                                <div className="flex items-center gap-4 group">
                                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-primary/30 transition-all">
                                        <Mail className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest mb-0.5">Email Us</p>
                                        <span className="text-sm font-bold text-white truncate block">{seller.contactEmail}</span>
                                    </div>
                                </div>
                            )}
                            {seller.contactPhone && (
                                <div className="flex items-center gap-4 group">
                                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-primary/30 transition-all">
                                        <Phone className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest mb-0.5">Business Line</p>
                                        <span className="text-sm font-bold text-white block">{seller.contactPhone}</span>
                                    </div>
                                </div>
                            )}
                            {seller.contactWhatsapp && (
                                <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-green-500/30 bg-green-500/5 text-green-400 hover:bg-green-600 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-green-500/10">
                                    <a href={`https://wa.me/${seller.contactWhatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                                        <MessageSquare className="h-4 w-4 mr-2" /> CHAT ON WHATSAPP
                                    </a>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest text-center py-4 italic border-2 border-dashed border-white/5 rounded-2xl">
                            Private Profile
                        </p>
                    )}

                    {hasSocial && (
                        <>
                            <Separator className="bg-white/5" />
                            <div className="space-y-4 pt-2">
                                <h5 className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500 text-center">OFFICIAL CHANNELS</h5>
                                <div className="flex justify-center gap-3">
                                    {seller.facebookUrl && <a href={seller.facebookUrl} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-blue-600 transition-all flex items-center justify-center border border-white/5"><Facebook className="h-5 w-5" /></a>}
                                    {seller.instagramUrl && <a href={seller.instagramUrl} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-pink-600 transition-all flex items-center justify-center border border-white/5"><Instagram className="h-5 w-5" /></a>}
                                    {seller.twitterUrl && <a href={seller.twitterUrl} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-2xl bg-white/5 hover:bg-sky-500 transition-all flex items-center justify-center border border-white/5"><Twitter className="h-5 w-5" /></a>}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-neutral-900 border-neutral-800 rounded-3xl shadow-2xl overflow-hidden">
                 <CardHeader className="bg-white/5 border-b border-white/5">
                     <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Operational Info</CardTitle>
                 </CardHeader>
                <CardContent className="p-8 space-y-6 text-neutral-300">
                    <div className="flex items-start gap-4">
                        <MapPin className="h-5 w-5 mt-1 text-primary shrink-0" />
                        <div>
                            <h5 className="font-black text-white text-[9px] uppercase tracking-widest mb-1">Base of Operations</h5>
                            <span className="text-sm font-medium">{seller.location || 'Global Seller'}</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <Clock className="h-5 w-5 mt-1 text-primary shrink-0" />
                        <div>
                            <h5 className="font-black text-white text-[9px] uppercase tracking-widest mb-1">Customer Service Hours</h5>
                            <span className="text-sm font-medium">{seller.storeHours || 'Response within 24h'}</span>
                        </div>
                    </div>
                     <div className="flex items-start gap-4">
                        <Globe className="h-5 w-5 mt-1 text-primary shrink-0" />
                        <div>
                            <h5 className="font-black text-white text-[9px] uppercase tracking-widest mb-1">On Platform Since</h5>
                            <span className="text-sm font-medium">{seller.joinedDate ? new Date(seller.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric'}) : 'Founding Member'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
