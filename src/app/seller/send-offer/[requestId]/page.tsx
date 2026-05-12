'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useFirestore, useDoc, useMemoFirebase, useUserProfile } from '@/firebase';
import { MapPin, Clock, Tag, Loader2, ArrowLeft, Send, Video, Camera, StopCircle, Trash2, ImageIcon, XCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { collection, doc, addDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import type { BuyerRequest, Offer } from '@/lib/types';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function SendOfferPage() {
  const params = useParams();
  const requestId = params.requestId as string;
  const router = useRouter();
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();

  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('24 Hours');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Media State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Fetch real request data
  const requestRef = useMemoFirebase(() => {
      if (!firestore || !requestId) return null;
      return doc(firestore, 'requests', requestId);
  }, [firestore, requestId]);

  const { data: request, isLoading } = useDoc<BuyerRequest>(requestRef);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        setVideoFile(new File([blob], `response_${Date.now()}.mp4`, { type: 'video/mp4' }));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Camera Error' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !request || !firestore) return;

    if (!price || !message) {
      toast({ variant: 'destructive', title: 'Details Required' });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);

    try {
        let offerVideoUrl = null;

        // 1. Upload Video Pitch if present
        if (videoFile) {
            const path = `offers/${user.uid}/${Date.now()}_pitch.mp4`;
            const storageRef = ref(storage, path);
            const uploadTask = uploadBytesResumable(storageRef, videoFile);

            offerVideoUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snap) => setUploadProgress(10 + (snap.bytesTransferred / snap.totalBytes) * 80),
                    (err) => reject(err),
                    async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
                );
            });
        }

        // 2. Save Offer
        const offerData: Omit<Offer, 'id'> = {
            requestId: requestId,
            sellerId: user.uid,
            sellerName: userProfile?.shopName || userProfile?.fullName || 'Verified Seller',
            sellerAvatar: userProfile?.profilePictureUrl || '',
            price: Number(price),
            message: message,
            videoUrl: offerVideoUrl as string | undefined,
            deliveryTime: deliveryTime,
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(firestore, 'offers'), offerData);

        // 3. Update Request Offer Count
        await updateDoc(doc(firestore, 'requests', requestId), {
            offersCount: increment(1)
        });

        setUploadProgress(100);
        toast({ title: 'Pitch Sent!', description: 'Your competitive offer has been submitted.' });
        router.push('/seller/offers');

    } catch (error: any) {
        console.error("Submission failed:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not send offer. Please check your connection.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SellerLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </SellerLayout>
    );
  }

  if (!request) {
    return (
      <SellerLayout>
        <div className="p-8 text-center flex flex-col items-center justify-center h-[60vh]">
            <XCircle className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
            <h2 className="text-xl font-bold text-white">Lead Not Found</h2>
            <p className="text-muted-foreground mt-2">This request might have been closed or removed.</p>
            <Button variant="link" onClick={() => router.push('/requests')}>Back to Marketplace</Button>
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <Button variant="ghost" className="mb-4 uppercase font-black text-[10px] tracking-[0.2em] text-white" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lead Market
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Buyer Request Display */}
          <div className="space-y-6 lg:sticky lg:top-24">
            <Card className="bg-neutral-900/50 border-white/5 overflow-hidden rounded-[2.5rem] shadow-2xl">
              <CardHeader className="p-8 pb-4">
                <Badge className="bg-primary/20 text-primary border-none text-[8px] font-black uppercase tracking-widest rounded-full mb-4 w-fit px-3 py-1">
                    {request.category}
                </Badge>
                <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-tight text-white">{request.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium text-base mt-2 leading-relaxed">{request.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                {request.videoUrl && (
                  <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 shadow-inner group">
                    <video src={request.videoUrl} controls className="w-full h-full object-cover" />
                  </div>
                )}

                {request.imageUrls && request.imageUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                        {request.imageUrls.map((url, i) => (
                            <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
                                <Image src={url} alt={`Evidence ${i}`} fill className="object-cover" />
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1 shadow-lg">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Buyer Budget</p>
                    <p className="text-lg font-black text-primary">KES {request.minBudget?.toLocaleString()} - {request.maxBudget?.toLocaleString()}</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1 shadow-lg">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Deadline</p>
                    <p className="text-lg font-black text-white uppercase">{request.deadline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-black text-neutral-400 uppercase tracking-widest px-2">
                  <div className="p-2 bg-primary/10 rounded-full"><MapPin className="h-4 w-4 text-primary" /></div>
                  {request.area}, {request.county}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seller Offer Form */}
          <div className="space-y-6">
            <Card className="bg-neutral-950 border-primary/20 shadow-[0_0_100px_rgba(255,100,0,0.1)] rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 pb-4 bg-primary/5 border-b border-white/5">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Send Your Pitch</CardTitle>
                <CardDescription className="font-bold text-primary/60 text-xs uppercase tracking-widest">Craft a competitive offer to win this customer.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSendOffer}>
                <CardContent className="p-8 space-y-8">
                  
                  <div className="space-y-4">
                    <Label className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Video Pitch (Optional)</Label>
                    <div className="relative aspect-video rounded-3xl bg-neutral-900 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group">
                        {videoFile ? (
                            <>
                                <video src={URL.createObjectURL(videoFile)} className="h-full w-full object-cover" />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-4 right-4 h-10 w-10 rounded-full shadow-2xl" onClick={() => setVideoFile(null)}><Trash2 className="h-5 w-5"/></Button>
                            </>
                        ) : isRecording ? (
                            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-3">
                                <Video className="h-10 w-10 text-neutral-700" />
                                <p className="text-[10px] font-black text-neutral-600 uppercase">Pitch with video for 5x trust</p>
                            </div>
                        )}
                        
                        {isRecording && (
                            <div className="absolute top-4 left-4 bg-red-600 px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-xl">
                                <div className="h-2 w-2 rounded-full bg-white" />
                                <span className="text-[10px] font-black text-white">RECORDING PITCH</span>
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
                        {isRecording ? 'STOP & SAVE PITCH' : 'RECORD VIDEO RESPONSE'}
                    </Button>
                  </div>

                  <Separator className="bg-white/5" />

                  <div className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="price" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Your Price (KES)</Label>
                        <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/40" />
                        <Input
                            id="price"
                            type="number"
                            placeholder="e.g. 2200"
                            className="pl-12 h-14 bg-white/5 rounded-2xl border-white/10 text-lg font-black focus-visible:ring-primary shadow-inner text-white"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                        />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="delivery" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Fulfillment Time</Label>
                        <Input
                        id="delivery"
                        placeholder="e.g. Delivery within 1 Hour"
                        className="h-14 bg-white/5 rounded-2xl border-white/10 font-bold shadow-inner text-white"
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="message" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Sales Pitch / Message</Label>
                        <Textarea
                        id="message"
                        rows={5}
                        placeholder="Explain why the buyer should choose you..."
                        className="bg-white/5 rounded-2xl border-white/10 text-sm font-medium leading-relaxed shadow-inner text-white"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-8 pt-0 flex flex-col gap-6">
                  {isSubmitting && (
                      <div className="w-full space-y-2 px-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-primary"><span>Transmitting Data...</span><span>{Math.round(uploadProgress)}%</span></div>
                          <Progress value={uploadProgress} className="h-1" />
                      </div>
                  )}
                  <Button type="submit" className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/30" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Send className="mr-2 h-6 w-6" />}
                    SEND PITCH NOW
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