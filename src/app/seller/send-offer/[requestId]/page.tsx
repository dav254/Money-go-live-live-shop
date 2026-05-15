'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SellerLayout } from '@/components/layout/seller-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser, useUserProfile } from '@/firebase';
import { MapPin, Clock, Tag, Loader2, ArrowLeft, Send, Video, Camera, StopCircle, Trash2, Sparkles, BrainCircuit, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Mock Lead Data
const MOCK_LEAD = {
    id: 'req_1',
    title: 'Need Professional Video Lighting Kit',
    description: 'Looking for a complete ring light or softbox setup for a new studio. Budget is around 15k. Must include tripod and phone holder. Prefer local pickup in Nairobi.',
    category: 'Electronics & Gadgets',
    minBudget: 12000,
    maxBudget: 18000,
    deadline: 'Urgent',
    area: 'Westlands',
    county: 'Nairobi',
    videoUrl: 'https://picsum.photos/seed/lighting/600/400'
};

export default function SendOfferPage() {
  const params = useParams();
  const requestId = params.requestId as string;
  const router = useRouter();
  const { user } = useUser();
  const { toast } = useToast();

  const [price, setPrice] = useState('14500');
  const [message, setMessage] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('Same Day Pickup');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  
  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        setVideoFile(new File([blob], `pitch_${Date.now()}.mp4`, { type: 'video/mp4' }));
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

  const generateAIPitch = () => {
    setIsGeneratingPitch(true);
    toast({ title: "Go-AI Drafting...", description: "Analyzing lead requirements for maximum conversion." });
    
    setTimeout(() => {
        const pitch = `Hi! I have the perfect professional lighting kit in stock at Westlands. It includes a 14" high-CRI ring light, heavy-duty 2M tripod, and 3 distinct light modes (Warm, Natural, Cold). Since you're in a hurry, you can pick it up from my shop today or I can Boda it to you in 30 mins!`;
        setMessage(pitch);
        setIsGeneratingPitch(false);
        toast({ title: "AI Pitch Ready!", description: "Tailored for urgent Westlands fulfillment." });
    }, 1500);
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
        toast({ title: 'Offer Sent!', description: 'Your pitch is now visible to the buyer.' });
        setIsSubmitting(false);
        router.push('/seller/offers');
    }, 2000);
  };

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
                    {MOCK_LEAD.category}
                </Badge>
                <CardTitle className="text-3xl font-black uppercase tracking-tighter leading-tight text-white">{MOCK_LEAD.title}</CardTitle>
                <CardDescription className="text-neutral-400 font-medium text-base mt-2 leading-relaxed">{MOCK_LEAD.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="aspect-video w-full bg-black rounded-3xl overflow-hidden border border-white/10 shadow-inner group">
                    <video src={MOCK_LEAD.videoUrl} controls className="w-full h-full object-cover" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1 shadow-lg">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Buyer Budget</p>
                    <p className="text-lg font-black text-primary">KES {MOCK_LEAD.minBudget.toLocaleString()} - {MOCK_LEAD.maxBudget.toLocaleString()}</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 space-y-1 shadow-lg">
                    <p className="text-[9px] font-black uppercase text-neutral-500 tracking-widest">Deadline</p>
                    <p className="text-lg font-black text-white uppercase">{MOCK_LEAD.deadline}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-black text-neutral-400 uppercase tracking-widest px-2">
                  <div className="p-2 bg-primary/10 rounded-full"><MapPin className="h-4 w-4 text-primary" /></div>
                  {MOCK_LEAD.area}, {MOCK_LEAD.county}
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
                            placeholder="e.g. 14500"
                            className="pl-12 h-14 bg-white/5 rounded-2xl border-white/10 text-lg font-black focus-visible:ring-primary shadow-inner text-white"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                        />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end mb-1">
                            <Label htmlFor="message" className="uppercase text-[10px] font-black tracking-widest text-neutral-500 ml-1">Sales Pitch / Message</Label>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-black text-[9px] uppercase gap-1.5"
                                onClick={generateAIPitch}
                                disabled={isGeneratingPitch}
                            >
                                {isGeneratingPitch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                GENERATE AI PITCH
                            </Button>
                        </div>
                        <Textarea
                            id="message"
                            rows={6}
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
