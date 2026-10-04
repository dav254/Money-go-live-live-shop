'use client';

import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  UploadCloud, X, Loader2, ImageIcon, CheckCircle2, Video, Sparkles,
  ArrowLeft, ArrowRight, Eye, Star, Tag, Package, Truck, BadgeCheck,
  Play, Plus, Wand2,
} from 'lucide-react';
import Image from 'next/image';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, deleteField, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import {
  MAX_IMAGES_PER_LISTING as MAX_IMAGES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_LABEL,
  MAX_VIDEO_SIZE_MB,
  MAX_VIDEOS_PER_LISTING as MAX_VIDEOS,
  PRICE_MODES,
  SERVICE_CATEGORIES,
} from '@/lib/listings/limits';
import type { Product } from '@/lib/types';
import { uploadMedia, type UploadProgress } from '@/lib/media/upload-client';
import { cn } from '@/lib/utils';
import { VidnovLogo } from '@/components/logo';

/**
 * Rejects anything longer than the platform maximum before a single byte is
 * uploaded.
 *
 * Read from the file's own metadata via a detached `<video>` element rather
 * than trusted from the browser: `accept="video/*"` stops nothing, and a
 * two-minute cap that only fails after a 100MB upload has finished is a cap
 * nobody discovers until they have already spent the bandwidth.
 */
function videoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const seconds = Number(probe.duration);
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? seconds : 0);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      // Unreadable metadata must not block the upload — the server trims too.
      resolve(0);
    };
    probe.src = url;
  });
}

const formSchema = z.object({
  name: z.string().min(2, { message: 'Product name is required.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  condition: z.enum(['new', 'used'], { required_error: 'Please select item condition.' }),
  localCurrency: z.string().default('KES'),
  localPrice: z.coerce.number().min(0, { message: 'Sale price must be 0 or higher.' }),
  price: z.coerce.number().min(0.01, { message: 'USD value must be greater than 0.' }),
  shippingCost: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0, { message: 'Stock cannot be negative.' }),
  description: z.string().min(10, { message: 'Please provide a detailed description (min 10 chars).' }),
  tags: z.string().optional(),
  deliveryOptions: z.string().min(5, { message: 'Describe your delivery process.' }),
  wasPrice: z.coerce.number().optional().nullable(),
});

interface ProductUploadFormProps {
  productToEdit?: Product;
  onFormSubmit?: () => void;
}

const STEPS = [
  { id: 0, label: 'Media', icon: ImageIcon, hint: 'Photos & video sell 10× better' },
  { id: 1, label: 'Details', icon: Tag, hint: 'Name it, describe it, tag it' },
  { id: 2, label: 'Price & Delivery', icon: Package, hint: 'Set your value, ship it' },
];

export function ProductUploadForm({ productToEdit, onFormSubmit }: ProductUploadFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(new Array(MAX_IMAGES).fill(null));
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  /*
   * Listing type.
   *
   * A service is a listing, not a different thing — same document, same feed,
   * same comments, same order. All this switch does is change which fields are
   * asked for, because a plumber's questions are "which trade, which area,
   * quote or hourly" and a car seller's are "condition, stock, shipping".
   */
  const [listingType, setListingType] = useState<'product' | 'service'>(
    productToEdit?.listingType === 'service' ? 'service' : 'product',
  );

  /*
   * The seller's total media usage across EVERY listing.
   *
   * The per-listing caps below (5 photos, 3 clips) are not the quota — a
   * seller with 40 listings could otherwise put 320 items up, which makes
   * "80 media items" a number that means nothing. This is read from the
   * server, because only the Admin SDK can sum across a seller's listings;
   * Firestore rules see one document at a time and cannot count.
   *
   * Editing an existing listing does not double-count: the media already on
   * that listing is in `used`, so only NEW files are charged here.
   */
  const [quota, setQuota] = useState<{ used: number; quota: number; remaining: number } | null>(null);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { getAuth: getClientAuth } = await import('firebase/auth');
        const token = await getClientAuth().currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch('/api/listings/quota', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { used: number; quota: number; remaining: number };
        if (alive) setQuota(data);
      } catch {
        /* Offline or unauthenticated: the publish step re-checks and refuses
           with a clear message, so a failed count must not block the form. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Media this submission would add on top of what the seller already uses.
  const pendingMediaCount =
    imageFiles.filter((f): f is File => f instanceof File).length +
    (productToEdit ? 0 : videoFiles.length);
  const quotaBlocked = Boolean(quota && quota.remaining <= 0 && pendingMediaCount > 0);
  const [priceMode, setPriceMode] = useState<'quote' | 'hourly' | 'fixed'>(
    (productToEdit?.priceMode as 'quote' | 'hourly' | 'fixed') || 'fixed',
  );
  const [serviceCategory, setServiceCategory] = useState(
    productToEdit?.serviceCategory || 'other',
  );
  const [serviceArea, setServiceArea] = useState(productToEdit?.serviceArea || '');
  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: 'Other',
      condition: 'new',
      localCurrency: 'KES',
      localPrice: 0,
      price: 0,
      shippingCost: 0,
      stock: 1,
      description: '',
      tags: '',
      deliveryOptions: '',
    },
  });

  // Live preview values
  const nameValue = form.watch('name');
  const priceValue = form.watch('localPrice');
  const currencyValue = form.watch('localCurrency');
  const wasPriceValue = form.watch('wasPrice');
  const categoryValue = form.watch('category');
  const conditionValue = form.watch('condition');
  const descriptionValue = form.watch('description');

  useEffect(() => {
    if (productToEdit) {
      const urls = productToEdit.imageUrls || (productToEdit.imageUrl ? [productToEdit.imageUrl] : []);
      const initialPreviews = new Array(MAX_IMAGES).fill(null);
      urls.forEach((url, i) => { if (i < MAX_IMAGES) initialPreviews[i] = url; });
      setImagePreviews(initialPreviews);
      setExistingVideoUrls(productToEdit.videoUrls || (productToEdit.videoUrl ? [productToEdit.videoUrl] : []));

      form.reset({
        name: productToEdit.name || '',
        category: productToEdit.category || 'Other',
        condition: productToEdit.condition || 'new',
        localCurrency: productToEdit.localCurrency || 'KES',
        localPrice: productToEdit.localPrice || 0,
        price: productToEdit.price || 0,
        shippingCost: productToEdit.shippingCost || 0,
        stock: productToEdit.stock || 0,
        description: productToEdit.description || '',
        tags: productToEdit.tags || '',
        deliveryOptions: productToEdit.deliveryOptions || '',
        wasPrice: productToEdit.wasPrice || null,
      });
    }
  }, [productToEdit, form]);

  const handleImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Invalid File', description: 'Only image files are allowed.' });
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Image Too Large', description: `Images must be ${MAX_IMAGE_SIZE_MB}MB or smaller.` });
        return;
      }
      const newFiles = [...imageFiles];
      newFiles[index] = file;
      setImageFiles(newFiles);

      const objectUrl = URL.createObjectURL(file);
      const newPreviews = [...imagePreviews];
      if (newPreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(newPreviews[index]!);
      newPreviews[index] = objectUrl;
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    if (imagePreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(imagePreviews[index]!);
    const newFiles = [...imageFiles];
    newFiles[index] = null;
    setImageFiles(newFiles);
    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
  };

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      if (videoFiles.length + newFiles.length + existingVideoUrls.length > MAX_VIDEOS) {
        toast({ variant: 'destructive', title: 'Video Limit Reached', description: `A product can have up to ${MAX_VIDEOS} videos.` });
        return;
      }
      for (const file of newFiles) {
        if (!file.type.startsWith('video/')) {
          toast({ variant: 'destructive', title: 'Invalid File', description: `${file.name} is not a video.` });
          return;
        }
        if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
          toast({ variant: 'destructive', title: 'Video Too Large', description: `${file.name} exceeds the ${MAX_VIDEO_SIZE_MB}MB limit.` });
          return;
        }
      }

      /*
       * Duration, checked before upload rather than after.
       *
       * `accept="video/*"` stops nothing and the file picker shows no length,
       * so without this a seller only discovers the limit after the whole clip
       * has been sent. Probing metadata is cheap and local.
       */
      void (async () => {
        for (const file of newFiles) {
          const seconds = await videoDurationSeconds(file);
          if (seconds > MAX_VIDEO_SECONDS + 0.5) {
            toast({
              variant: 'destructive',
              title: 'Video Too Long',
              description: `${file.name} is ${Math.round(seconds / 60 * 10) / 10} min. The maximum is ${MAX_VIDEO_LABEL}.`,
            });
            return;
          }
        }
        setVideoFiles(prev => [...prev, ...newFiles]);
        const newPreviews = newFiles.map(f => URL.createObjectURL(f));
        setVideoPreviews(prev => [...prev, ...newPreviews]);
      })();
    }
  };

  const removeVideo = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingVideoUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      if (videoPreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(videoPreviews[index]);
      setVideoFiles(prev => prev.filter((_, i) => i !== index));
      setVideoPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const coverImage = useMemo(() => imagePreviews.find(p => !!p) || null, [imagePreviews]);

  /**
   * Uploads a file through the Vidnov VPS media system. The server
   * compresses it (WebP/H.264), generates a thumbnail, deletes the
   * original and returns optimized URLs. Progress is reported in two
   * phases: uploading (real %) and processing (server-side).
   */
  const uploadViaVps = async (file: File, onPhase?: (p: UploadProgress) => void): Promise<{ url: string; thumbnailUrl?: string }> => {
    if (!user) throw new Error('You must be signed in to upload media.');

    const handle = uploadMedia(file, user, (p) => onPhase?.(p));
    const result = await handle.promise;
    if (result.phase === 'failed' || !result.url) {
      throw new Error(result.error || 'Media processing failed.');
    }
    return { url: result.url, thumbnailUrl: result.thumbnailUrl };
  };

  const validateStep = async (s: number): Promise<boolean> => {
    if (s === 0) {
      const hasMedia = imagePreviews.some(Boolean) || videoFiles.length > 0 || existingVideoUrls.length > 0;
      if (!hasMedia) {
        toast({ variant: 'destructive', title: 'Add at least one photo', description: 'Listings with photos get 5× more views.' });
        return false;
      }
      return true;
    }
    if (s === 1) {
      const ok = await form.trigger(['name', 'category', 'condition', 'description']);
      if (!ok) toast({ variant: 'destructive', title: 'Complete the details', description: 'Fill every required field to continue.' });
      return ok;
    }
    return true;
  };

  const goNext = async () => {
    if (await validateStep(step)) setStep(s => Math.min(2, s + 1));
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!(await validateStep(0))) return;
    if (!(await validateStep(1))) return;

    if (!user) {
        toast({ variant: 'destructive', title: 'Session Expired', description: 'Please sign in to continue.' });
        return;
    }

    /*
     * Quota gate, checked last so it cannot fire before validation and before
     * the seller has actually added anything.
     *
     * Deliberately a refusal with an explanation rather than a silent trim: a
     * seller who arranged six photos and was told "only three were saved"
     * would have no idea which three survived.
     */
    if (quotaBlocked) {
      toast({
        variant: 'destructive',
        title: 'Media limit reached',
        description: `You have used all ${quota?.quota} media items across your listings. Delete something you no longer need, or upgrade for more space.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress({});

    try {
      // Process images sequentially for stability
      const finalImageUrls: string[] = [];
      const finalImageThumbs: string[] = [];
      for (let i = 0; i < MAX_IMAGES; i++) {
        const preview = imagePreviews[i];
        const file = imageFiles[i];
        if (preview && !preview.startsWith('blob:')) {
          finalImageUrls.push(preview);
          finalImageThumbs.push(preview);
        } else if (file instanceof File) {
          const { url, thumbnailUrl } = await uploadViaVps(file, (p) =>
            setUploadProgress((prev) => ({ ...prev, [`img-${i}`]: p.percent })),
          );
          finalImageUrls.push(url);
          finalImageThumbs.push(thumbnailUrl || url);
        }
      }

      // Process videos sequentially
      const finalVideoUrls: string[] = [...existingVideoUrls];
      const finalVideoThumbs: string[] = [...(productToEdit?.videoThumbnailUrls || [])];
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const { url, thumbnailUrl } = await uploadViaVps(file, (p) =>
          setUploadProgress((prev) => ({ ...prev, [`vid-${i}`]: p.percent })),
        );
        finalVideoUrls.push(url);
        if (thumbnailUrl) finalVideoThumbs.push(thumbnailUrl);
      }

      const productData: any = {
        ...values,
        // Service fields are written on every listing: a product gets them
        // cleared rather than left stale, so switching a listing from service
        // back to product cannot leave "Plumbing" on a second-hand sofa.
        listingType,
        ...(listingType === 'service'
          ? { serviceCategory, serviceArea, priceMode }
          : { serviceCategory: deleteField(), serviceArea: deleteField(), priceMode: deleteField() }),
        // A quote-based service has no meaningful unit price; zero is honest
        // here and the drawer renders "Get a quote" off `priceMode`.
        ...(listingType === 'service' && priceMode === 'quote'
          ? { price: 0, localPrice: 0, shippingCost: 0 }
          : {}),
        imageUrl: finalImageUrls[0] || '',
        imageUrls: finalImageUrls,
        thumbnailUrls: finalImageThumbs,
        videoUrl: finalVideoUrls[0] || '',
        videoUrls: finalVideoUrls,
        videoThumbnailUrls: finalVideoThumbs,
        hasVideo: finalVideoUrls.length > 0,
        updatedAt: serverTimestamp(),
      };

      if (productToEdit) {
        await updateDoc(doc(firestore, 'products', productToEdit.id), productData);
        toast({ title: 'Listing updated', description: 'Your changes are live with optimized media.' });
      } else {
        const created = await addDoc(collection(firestore, 'products'), {
          ...productData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          inCartCount: 0,
          salesCount: 0
        });

        /*
         * Make sure this seller has a business.
         *
         * Publishing a listing is a seller saying "I trade here", which is the
         * only question Nearby, service areas, verification and Sponsored all
         * depend on. Asking them to also fill in a shop form was the gap that
         * left one seller with live orders and no business at all.
         *
         * Fire-and-forget on purpose: the listing is already published and must
         * not appear to fail because a background tidy-up did. The server
         * resolves the seller from this listing and verifies it belongs to the
         * caller, so nothing here can be abused.
         */
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/businesses/ensure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ productId: created.id }),
          });
        } catch {
          /* Non-fatal — the next publish will retry. */
        }

        toast({ title: 'Listing published', description: 'Your product is now live in discovery.' });
      }
      onFormSubmit?.();
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message || 'Something interrupted the upload. Try again.' });
    } finally {
      setIsUploading(false);
    }
  }

  const onInvalid = (errors: any) => {
    const firstError = Object.values(errors)[0] as any;
    toast({
        variant: 'destructive',
        title: 'Almost there',
        description: firstError?.message || 'Check the highlighted fields.',
    });
    // Jump to the earliest step containing an error
    if (errors.name || errors.category || errors.condition || errors.description) setStep(1);
    else if (errors.price || errors.stock || errors.deliveryOptions) setStep(2);
  };

  const inputCls = 'h-12 rounded-xl border-border bg-background/60 focus-visible:ring-primary/30 focus-visible:border-primary/50';
  const mediaUploading = Object.values(uploadProgress);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
      {/* ============ MAIN COLUMN ============ */}
      <div>
        {/* Step rail */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-4 py-3 vn-transition border text-left',
                    active && 'border-primary/40 bg-primary/5 vn-shadow-glow',
                    !active && done && 'border-emerald-500/30 bg-emerald-500/5',
                    !active && !done && 'border-border bg-card hover:border-foreground/20',
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold',
                    active && 'vn-grad-coral text-white',
                    done && 'bg-emerald-500 text-white',
                    !active && !done && 'bg-muted text-muted-foreground',
                  )}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className={cn('block text-[12px] font-semibold leading-tight', active ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
                    <span className="hidden sm:block text-[10px] text-muted-foreground/70 leading-tight">{s.hint}</span>
                  </span>
                </button>
                {i < STEPS.length - 1 && <div className={cn('h-px flex-1 min-w-4', done ? 'bg-emerald-500/40' : 'bg-border')} />}
              </React.Fragment>
            );
          })}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)}>
          {/* ============ STEP 0 — MEDIA ============ */}
          {step === 0 && (
            <div className="space-y-6 vn-phase">
              <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-grotesk text-xl font-bold">Show it off</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Up to {MAX_IMAGES} photos and {MAX_VIDEOS} videos. We auto-compress everything to WebP/H.264 on your VPS — originals are never kept.
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                    <BadgeCheck className="h-3 w-3" /> Auto-optimized
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="group relative aspect-square rounded-xl border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden vn-transition hover:border-primary/50">
                      {preview ? (
                        <>
                          <Image src={preview} alt={`Product photo ${i + 1}`} fill className="object-cover" />
                          {i === 0 && (
                            <span className="absolute top-1.5 left-1.5 rounded-md bg-primary px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white z-10">Cover</span>
                          )}
                          <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 vn-transition hover:bg-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button type="button" className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground/50 vn-transition hover:text-primary" onClick={() => imageInputRefs.current[i]?.click()}>
                          <Plus className="h-5 w-5" />
                          <span className="text-[9px] font-semibold uppercase tracking-widest">Add</span>
                        </button>
                      )}
                      <input type="file" className="hidden" ref={el => { imageInputRefs.current[i] = el; }} accept="image/*" onChange={(e) => handleImageChange(i, e)} />
                    </div>
                  ))}
                </div>

                {mediaUploading.length > 0 && mediaUploading.some(v => v > 0 && v < 100) && (
                  <div className="mt-5 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-primary">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compressing on Vidnov media engine…
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
                <h3 className="font-grotesk text-xl font-bold flex items-center gap-2">
                  Video <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 rounded-full px-2.5 py-1">Boosts conversion 10×</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1 mb-5">MP4 or WebM · up to {MAX_VIDEOS} clips · {MAX_VIDEO_SIZE_MB}MB each · maximum {MAX_VIDEO_LABEL}, compressed to 720p automatically.</p>

                <label className="flex h-28 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 vn-transition hover:border-cyan-500/50 hover:bg-cyan-500/5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl vn-grad-ocean text-white"><Video className="h-5 w-5" /></span>
                  <span className="text-sm font-medium text-muted-foreground">Drop product videos or <span className="text-cyan-600 dark:text-cyan-400 font-semibold">browse</span></span>
                  <input type="file" accept="video/*" multiple className="hidden" onChange={handleVideoChange} />
                </label>

                {(videoFiles.length > 0 || existingVideoUrls.length > 0) && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {existingVideoUrls.map((url, i) => (
                      <div key={`ex-${i}`} className="group relative aspect-video rounded-xl overflow-hidden border border-border bg-ember-navy">
                        <video src={url} className="h-full w-full object-cover" muted />
                        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">Live</span>
                        <button type="button" onClick={() => removeVideo(i, true)} className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 vn-transition hover:bg-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    {videoFiles.map((file, i) => (
                      <div key={`new-${i}`} className="group relative aspect-video rounded-xl overflow-hidden border border-cyan-500/30 bg-ember-navy">
                        <video src={videoPreviews[i]} className="h-full w-full object-cover" muted />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Play className="h-6 w-6 text-white" /></div>
                        <button type="button" onClick={() => removeVideo(i, false)} className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 vn-transition hover:bg-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="button" onClick={goNext} className="h-12 px-8 rounded-xl font-semibold vn-shadow-glow">
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ============ STEP 1 — DETAILS ============ */}
          {step === 1 && (
            <div className="space-y-6 vn-phase">
              <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="font-grotesk text-xl font-bold">Tell buyers what it is</h3>
                  <p className="text-sm text-muted-foreground mt-1">Clear names and honest descriptions rank higher in Vidnov discovery.</p>
                </div>

                {/*
                  The one switch that decides whether this is stock or a
                  trade. It is first because it changes what every field below
                  it is asking for, and burying it at the bottom of the form
                  meant service sellers filled in "condition" and "stock" and
                  then had to delete it.
                */}
                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">What are you listing?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'product', title: 'A product', hint: 'Something to buy and have delivered' },
                      { key: 'service', title: 'A service', hint: 'Work you do — no delivery needed' },
                    ] as const).map(opt => (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setListingType(opt.key)}
                        aria-pressed={listingType === opt.key}
                        className={cn(
                          'rounded-xl border p-3 text-left transition',
                          listingType === opt.key
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50',
                        )}
                      >
                        <p className="text-sm font-semibold">{opt.title}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {listingType === 'service' && (
                  <div className="space-y-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs text-muted-foreground">
                      Services trade in the same feed, shop and checkout as products. If your trade
                      is not listed, pick &ldquo;Other services&rdquo; and name it in the description —
                      we would rather you could sell than sit behind a missing category.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Trade</Label>
                        <Select value={serviceCategory} onValueChange={setServiceCategory}>
                          <SelectTrigger className={inputCls}><SelectValue placeholder="Choose a trade" /></SelectTrigger>
                          <SelectContent>
                            {SERVICE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How do you charge?</Label>
                        <Select value={priceMode} onValueChange={(v) => setPriceMode(v as 'quote' | 'hourly' | 'fixed')}>
                          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRICE_MODES.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Where will you work?</Label>
                      <Input
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        placeholder="e.g. Westlands, Nairobi — or remote across Kenya"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {listingType === 'service' ? 'Service name' : 'Product name'}
                  </Label>
                  <Input placeholder="e.g. Handwoven Sisal Tote — Natural" className={inputCls} {...form.register('name')} />
                  {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Category</Label>
                    <Select onValueChange={(v) => form.setValue('category', v)} value={form.getValues('category')}>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>{PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.formState.errors.category && <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Condition</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['new', 'used'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => form.setValue('condition', c)}
                          className={cn(
                            'h-12 rounded-xl border text-[12px] font-semibold uppercase tracking-widest vn-transition',
                            conditionValue === c
                              ? 'border-primary/50 bg-primary/10 text-primary'
                              : 'border-border bg-background/60 text-muted-foreground hover:border-foreground/20',
                          )}
                        >
                          {c === 'new' ? 'Brand new' : 'Pre-owned'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Description</Label>
                  <Textarea
                    rows={6}
                    className="rounded-xl border-border bg-background/60 resize-none focus-visible:ring-primary/30 focus-visible:border-primary/50"
                    placeholder="What makes it special? Materials, sizing, what's included, why buyers love it…"
                    {...form.register('description')}
                  />
                  {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
                  <p className="text-[11px] text-muted-foreground">{(descriptionValue || '').length} characters · aim for 150+ for the best ranking</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" /> Tags <span className="normal-case tracking-normal font-normal text-muted-foreground/70">(optional, comma separated)</span></Label>
                  <Input placeholder="handmade, Nairobi, gift, summer" className={inputCls} {...form.register('tags')} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(0)} className="rounded-xl font-semibold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="button" onClick={goNext} className="h-12 px-8 rounded-xl font-semibold vn-shadow-glow">Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {/* ============ STEP 2 — PRICE & DELIVERY ============ */}
          {step === 2 && (
            <div className="space-y-6 vn-phase">
              <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="font-grotesk text-xl font-bold">Price it, ship it</h3>
                  <p className="text-sm text-muted-foreground mt-1">The USD value locks your price for global settlement.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-1 space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Currency</Label>
                    <Select onValueChange={(v) => form.setValue('localCurrency', v)} value={form.getValues('localCurrency')}>
                      <SelectTrigger className={cn(inputCls, 'h-12')}><SelectValue /></SelectTrigger>
                      <SelectContent>{SUPPORTED_CURRENCIES.map(curr => <SelectItem key={curr.code} value={curr.code}>{curr.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sale price</Label>
                    <Input type="number" className={inputCls} {...form.register('localPrice')} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Was price</Label>
                    <Input type="number" placeholder="Optional" className={inputCls} {...form.register('wasPrice')} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-primary">USD value</Label>
                    <Input type="number" className="h-12 rounded-xl border-primary/30 bg-primary/5 font-bold" {...form.register('price')} />
                    {form.formState.errors.price && <p className="text-xs text-destructive">{form.formState.errors.price.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Stock</Label>
                    <Input type="number" className={inputCls} {...form.register('stock')} />
                    {form.formState.errors.stock && <p className="text-xs text-destructive">{form.formState.errors.stock.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Shipping fee (USD)</Label>
                    <Input type="number" className={inputCls} {...form.register('shippingCost')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-cyan-500" /> Delivery method</Label>
                  <Input placeholder="e.g. Courier nationwide, 1–3 days, pickup available" className={inputCls} {...form.register('deliveryOptions')} />
                  {form.formState.errors.deliveryOptions && <p className="text-xs text-destructive">{form.formState.errors.deliveryOptions.message}</p>}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(1)} className="rounded-xl font-semibold"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="submit" disabled={isUploading} className="h-14 px-10 rounded-xl text-[13px] font-bold uppercase tracking-widest vn-shadow-glow">
                  {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                  {isUploading ? 'Publishing…' : productToEdit ? 'Save changes' : 'Publish listing'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ============ LIVE PREVIEW ============ */}
      <aside className="hidden xl:block">
        <div className="sticky top-6 space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Eye className="h-4 w-4 text-primary" /> Live preview
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden vn-shadow">
            <div className="relative aspect-square bg-muted/40">
              {coverImage ? (
                <Image src={coverImage} alt="Product cover preview" fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground/40">
                  <VidnovLogo className="w-10 h-10" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">Your cover photo</span>
                </div>
              )}
              {wasPriceValue && Number(wasPriceValue) > Number(priceValue || 0) && (
                <span className="absolute top-3 left-3 rounded-lg bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  Save {Math.round(((Number(wasPriceValue) - Number(priceValue || 0)) / Number(wasPriceValue)) * 100)}%
                </span>
              )}
              {videoFiles.length > 0 && (
                <span className="absolute top-3 right-3 flex items-center gap-1 rounded-lg bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  <Play className="h-3 w-3" /> Video
                </span>
              )}
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-primary">{categoryValue || 'Category'}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{conditionValue === 'used' ? 'Pre-owned' : 'New'}</span>
              </div>
              <h4 className="font-grotesk text-lg font-bold leading-snug line-clamp-2">{nameValue || 'Product name appears here'}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed min-h-[2.5rem]">{descriptionValue || 'Your description appears here as buyers will see it.'}</p>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-grotesk text-2xl font-bold text-primary">
                  {currencyValue || 'KES'} {Number(priceValue || 0).toLocaleString()}
                </span>
                {wasPriceValue && Number(wasPriceValue) > Number(priceValue || 0) && (
                  <span className="text-sm text-muted-foreground line-through">{currencyValue} {Number(wasPriceValue).toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[1, 2, 3, 4, 5].map(n => <Star key={n} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                <span className="text-[11px] text-muted-foreground">New listing</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-2.5">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary"><Wand2 className="h-3.5 w-3.5" /> Seller tip</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {step === 0 && 'Listings with a video keep buyers on the page 2× longer. Even a 10-second pan of your product works.'}
              {step === 1 && 'Mention what the buyer gets, materials and sizing. Honest detail reduces returns.'}
              {step === 2 && 'A “was price” shows the discount badge automatically — buyers love a visible save.'}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
