
'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Tag, Loader2, ArrowLeft, Send, Video, Camera, StopCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, setDoc, collection } from 'firebase/firestore';
import type { BuyerRequest } from '@/lib/types';

export default function SendOfferPage() {
  const params = useParams();
  const requestId = params.requestId as string;
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const requestRef = useMemoFirebase(() => {
    if (!firestore || !requestId) return null;
    return doc(firestore, 'requests', requestId);
  }, [firestore, requestId]);

  const { data: lead, isLoading: isLeadLoading } = useDoc<BuyerRequest>(requestRef);

  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  React.useEffect(() => {
    if (lead && !price) {
        setPrice(String(lead.minBudget || ''));
    }
  }, [lead, price]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        setVideoFile(new File([blob], `pitch_${Date.now()}.mp4`, { type: 'video/mp4' }));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Camera Error', description: 'Enable camera access to record video pitches.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const generateAIPitch = () => {
    if (!lead) return;
    setIsGeneratingPitch(true);
    toast({ title: "Go-AI Drafting...", description: "Analyzing lead requirements." });
    
    setTimeout(() => {
        const pitch = `Hi! I have high-quality options in stock right now that match your requirement for "${lead.title}". Since you mentioned this is ${lead.deadline}, I can arrange for immediate delivery to ${lead.area} or you can pick it up from my shop today. My price is competitive and the quality is guaranteed. Looking forward to your response!`;
        setMessage(pitch);
        setIsGeneratingPitch(false);
        toast({ title: "AI Pitch Ready!", description: "Tailored to the buyer's urgency and location." });
    }, 1500);
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setIsSubmitting(true);
    
    setTimeout(() => {
        toast({ title: 'Pitch Sent Successfully!', description: 'You will be notified if the buyer accepts.' });
        setIsSubmitting(false);
        router.push('/seller/offers');
    }, 2000);
  };

  if (isLeadLoading) {
      return (
          <SellerLayout>
              <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
          </SellerLayout>
      );
  }

  if (!lead) {
      return (
          <SellerLayout>
              <div className="p-8 text-center">
                  <h2 className="text-xl font-bold">Request not found</h2>
                  <Button className="mt-4" onClick={() => router.push('/requests')}>Back to Marketplace</Button>
              </div>
          </SellerLayout>
      );
  }

  return (
    <SellerLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em] text-white/50 hover:text-white" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Market
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6 lg:sticky lg:top-24">
            <Card className="bg-neutral-900/50 border-white/5 overflow-hidden rounded-[2.5rem] shadow-2xl">
              <CardHeader className="p-8 pb-4">
                <Badge className="bg-primary/20 text-primary border-none text-[8px] font-black uppercase tracking-widest rounded-full mb-4 w-fit px-3 py-1">
                  {lead.category}
                </Badge>
                <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-tight text-white">{lead.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium text-base mt-2 leading-relaxed italic">"{lead.description}"</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {lead.requestType === 'video' && lead.videoUrl && (
                  <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 shadow-inner">
                    <video src={lead.videoUrl} className="w-full h-full object-cover opacity-60" controls />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Budget Window</p>
                    <p className="text-lg font-black text-primary">KES {lead.minBudget?.toLocaleString()} - {lead.maxBudget?.toLocaleString()}</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Urgency</p>
                    <p className="text-lg font-black text-white uppercase">{lead.deadline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-black text-neutral-400 uppercase tracking-widest px-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {lead.area}, {lead.county}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-neutral-950 border-primary/20 shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4 bg-primary/5 border-b border-white/5">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Create Your Pitch</CardTitle>
                <CardDescription className="font-bold text-primary/60 text-xs uppercase tracking-widest">Submit your best offer to win this deal.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSendOffer}>
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <Label className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Attach Video Pitch</Label>
                    <div className="relative aspect-video rounded-3xl bg-neutral-900 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                        {videoFile ? (
                            <video src={URL.createObjectURL(videoFile)} controls className="h-full w-full object-cover" />
                        ) : isRecording ? (
                            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-3 opacity-20">
                                <Video className="h-10 w-10" />
                                <p className="text-[10px] font-black uppercase">Record a visual response</p>
                            </div>
                        )}
                        {isRecording && (
                            <div className="absolute top-4 left-4 bg-red-600 px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse">
                                <div className="h-2 w-2 rounded-full bg-white" />
                                <span className="text-[10px] font-black text-white">RECORDING...</span>
                            </div>
                        )}
                    </div>
                    <Button 
                        type="button" 
                        variant="secondary"
                        className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={!!videoFile}
                    >
                        {isRecording ? <StopCircle className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
                        {isRecording ? 'STOP & SAVE' : 'START RECORDING'}
                    </Button>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="price" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Your Proposed Price (KES)</Label>
                        <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                        <Input
                            id="price"
                            type="number"
                            className="pl-12 h-14 bg-white/5 rounded-2xl border-white/10 text-lg font-black text-white shadow-inner"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                        />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                            <Label htmlFor="message" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Sales Pitch</Label>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-black text-[9px] uppercase gap-1.5"
                                onClick={generateAIPitch}
                                disabled={isGeneratingPitch}
                            >
                                {isGeneratingPitch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                AI DRAFT
                            </Button>
                        </div>
                        <Textarea
                            id="message"
                            rows={5}
                            placeholder="Why should the buyer choose you?"
                            className="bg-white/5 rounded-2xl border-white/10 text-sm font-medium leading-relaxed text-white shadow-inner"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                        />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-8 pt-0">
                  <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/30 border-none" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Send className="mr-2 h-6 w-6" />}
                    SUBMIT PITCH
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
