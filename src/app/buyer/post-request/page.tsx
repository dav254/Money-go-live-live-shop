
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Button } from '@/components/ui/button';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  X, 
  Video, 
  Loader2, 
  Megaphone, 
  CheckCircle2, 
  MapPin, 
  Keyboard,
  Camera,
  RefreshCw,
  Locate,
  StopCircle,
  ImageIcon
} from 'lucide-react';
import { kenyaLocations } from '@/lib/location-data';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';

const MAX_IMAGES = 3;
const MAX_VIDEO_DURATION = 30;

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  description: z.string().min(10, "Please provide more details about what you need."),
  category: z.string().min(1, "Please select a category."),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  currency: z.string().default('KES'),
  country: z.string().default('Kenya'),
  county: z.string().min(1, "Please select your county."),
  area: z.string().min(2, "Please enter your town or area."),
  contactMethod: z.enum(['chat', 'whatsapp', 'phone']),
  deadline: z.enum(['urgent', '3-days', 'flexible']),
  requestType: z.enum(['video', 'text']).default('text'),
});

export default function PostRequestPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = getStorage();
  const { toast } = useToast();
  const router = useRouter();

  const [requestMode, setRequestType] = useState<'video' | 'text'>('text');
  const [isUploading, setIsUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      minBudget: 1000,
      maxBudget: 2500,
      currency: 'KES',
      country: 'Kenya',
      county: '',
      area: '',
      contactMethod: 'chat',
      deadline: 'flexible',
      requestType: 'text',
    },
  });

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
        setVideoFile(new File([blob], `recorded_request_${Date.now()}.mp4`, { type: 'video/mp4' }));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera/mic.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => {
            if (prev >= MAX_VIDEO_DURATION) {
                stopRecording();
                return MAX_VIDEO_DURATION;
            }
            return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const newFiles = [...imageFiles];
        newFiles[index] = file;
        setImageFiles(newFiles);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);
  };

  const detectGPS = () => {
    if (!navigator.geolocation) {
        toast({ title: 'Geolocation Not Supported' });
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            toast({ title: 'Location Detected!' });
        },
        () => toast({ variant: 'destructive', title: 'GPS Failed' })
    );
  };

  const uploadFile = (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please sign in.' });
      return;
    }
    setIsUploading(true);

    try {
      let videoUrl = null;
      let imageUrls: string[] = [];

      // 1. Upload Video
      if (videoFile) {
        const path = `requests/${user.uid}/${Date.now()}_video.mp4`;
        videoUrl = await uploadFile(videoFile, path);
      }

      // 2. Upload Images
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        if (file instanceof File) {
          const path = `requests/${user.uid}/${Date.now()}_img_${i}.png`;
          const url = await uploadFile(file, path);
          imageUrls.push(url);
        }
      }

      // 3. Save to Firestore
      const requestData = {
        ...values,
        buyerId: user.uid,
        status: 'open',
        videoUrl,
        imageUrls,
        latitude: coords?.lat || null,
        longitude: coords?.lng || null,
        requestType: requestMode,
        offersCount: 0,
        selectedSellerId: null,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'requests'), requestData);
      
      toast({ title: 'Broadcast Published!', description: 'Sellers will be notified.' });
      router.push('/buyer/requests/my-requests');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Broadcast Failed', description: error.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  return (
    <BuyerLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                    <Megaphone className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="font-headline text-3xl font-black uppercase tracking-tighter text-white">Broadcast a Need</h1>
                    <p className="text-muted-foreground font-medium">Attract the right sellers in seconds.</p>
                </div>
            </div>
            
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-white/5">
                <button 
                    type="button"
                    onClick={() => setRequestType('text')}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all", requestMode === 'text' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground")}
                >
                    <Keyboard className="h-4 w-4" /> Type Request
                </button>
                <button 
                    type="button"
                    onClick={() => setRequestType('video')}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase transition-all", requestMode === 'video' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground")}
                >
                    <Video className="h-4 w-4" /> Record Video
                </button>
            </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-2 space-y-8">
                {requestMode === 'video' ? (
                    <Card className="bg-neutral-900 border-primary/20 overflow-hidden shadow-2xl">
                        <CardHeader className="bg-primary/5 border-b border-primary/10">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Step 1: Record Your Need</CardTitle>
                            <CardDescription>Explain what you are looking for. Max 30 seconds.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="relative aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden group shadow-2xl">
                                {videoFile ? (
                                    <video src={URL.createObjectURL(videoFile)} controls className="h-full w-full object-cover" />
                                ) : (
                                    <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                                )}
                                
                                {isRecording && (
                                    <div className="absolute top-4 left-4 bg-red-600 px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse shadow-xl">
                                        <div className="h-2 w-2 rounded-full bg-white" />
                                        <span className="text-[10px] font-black text-white">REC 00:{recordingDuration.toString().padStart(2, '0')}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex gap-4">
                                {!videoFile ? (
                                    <Button 
                                        type="button" 
                                        size="lg"
                                        className={cn("flex-1 h-16 rounded-2xl font-black uppercase tracking-widest", isRecording ? "bg-neutral-800" : "bg-red-600 hover:bg-red-700")}
                                        onClick={isRecording ? stopRecording : startRecording}
                                    >
                                        {isRecording ? <StopCircle className="mr-2" /> : <Camera className="mr-2" />}
                                        {isRecording ? 'STOP RECORDING' : 'START RECORDING'}
                                    </Button>
                                ) : (
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="lg"
                                        className="flex-1 h-16 rounded-2xl font-black border-white/10 text-white"
                                        onClick={() => setVideoFile(null)}
                                    >
                                        <RefreshCw className="mr-2 h-5 w-5" /> RE-RECORD
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-neutral-900 border-white/5 shadow-2xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">Media Evidence</CardTitle>
                            <CardDescription>Upload up to 3 clear images of what you need.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                {imageFiles.map((file, i) => (
                                    <div key={i} className="relative aspect-square rounded-2xl bg-neutral-950 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden hover:border-primary/50 transition-all cursor-pointer group">
                                        {file ? (
                                            <>
                                                <Image src={URL.createObjectURL(file as File)} alt={`Need ${i}`} fill className="object-cover" />
                                                <button 
                                                    type="button"
                                                    onClick={() => removeImage(i)}
                                                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2" onClick={() => (document.getElementById(`img-input-${i}`) as HTMLInputElement)?.click()}>
                                                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Slot {i+1}</span>
                                                <input 
                                                    id={`img-input-${i}`} 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    onChange={(e) => handleImageChange(i, e)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="bg-neutral-900 border-white/5 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">Need Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Summary</FormLabel>
                        <FormControl><Input placeholder="e.g. Need office laptop under 30k" className="h-12 bg-black/40 border-white/10 text-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-12 bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="deadline" render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-12 bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="urgent">Urgent (Today)</SelectItem>
                                    <SelectItem value="3-days">Within 3 Days</SelectItem>
                                    <SelectItem value="flexible">Flexible</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Details</FormLabel>
                        <FormControl><Textarea rows={6} className="bg-black/40 border-white/10 text-white" placeholder="Describe what you need in detail..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="bg-neutral-900 border-white/5 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-lg font-black uppercase tracking-widest text-primary">Budget & Location</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="minBudget" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Min (KES)</FormLabel>
                                <FormControl><Input type="number" className="h-12 bg-black/40 border-white/10 text-white" {...field} /></FormControl>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="maxBudget" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Max (KES)</FormLabel>
                                <FormControl><Input type="number" className="h-12 bg-black/40 border-white/10 text-white" {...field} /></FormControl>
                            </FormItem>
                        )} />
                    </div>

                    <div className="space-y-4">
                        <Button type="button" variant="secondary" className="w-full h-12 rounded-xl uppercase font-black text-[10px] tracking-widest" onClick={detectGPS}>
                            <Locate className="mr-2 h-4 w-4" /> Detect Current GPS
                        </Button>
                        {coords && <p className="text-[10px] text-center text-primary font-bold">GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>}
                    </div>

                    <FormField control={form.control} name="county" render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">County</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {Object.keys(kenyaLocations).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />

                    <FormField control={form.control} name="area" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Town / Area</FormLabel>
                        <FormControl><Input placeholder="e.g. Westlands" className="h-12 bg-black/40 border-white/10 text-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    
                    <FormField control={form.control} name="contactMethod" render={({ field }) => (
                        <FormItem>
                        <FormLabel className="font-black text-[10px] uppercase tracking-widest text-neutral-400">Contact Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="chat">In-App Chat</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="phone">Phone Call</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <div className="space-y-4">
                     {isUploading && (
                        <div className="space-y-2 px-2">
                             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-primary">
                                 <span>Broadcasting...</span>
                                 <span>{Math.round(uploadProgress)}%</span>
                             </div>
                             <Progress value={uploadProgress} className="h-1" />
                        </div>
                     )}
                    <Button type="submit" className="w-full h-16 font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 rounded-2xl" disabled={isUploading}>
                        {isUploading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                        PUBLISH BROADCAST
                    </Button>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </BuyerLayout>
  );
}
