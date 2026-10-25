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
  MIN_IMAGES_PER_LISTING,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SECONDS,
  MAX_VIDEO_LABEL,
  MAX_VIDEO_SIZE_MB,
  MAX_VIDEOS_PER_LISTING as MAX_VIDEOS,
  PRICE_MODES,
  SERVICE_CATEGORIES,
  SELLER_MEDIA_QUOTA_FREE,
} from '@/lib/listings/limits';
import type { Product } from '@/lib/types';
import { uploadMedia, type UploadProgress } from '@/lib/media/upload-client';
import { mirrorProduct } from '@/lib/products/mirror';
import { cn } from '@/lib/utils';
import { VidnovLogo } from '@/components/logo';
import { PricingUploadCard } from '@/components/seller/pricing-upload-card';
import { useQuota } from '@/lib/media/use-quota';

/**
 * A video's poster must be an image an `<img>` can actually paint.
 *
 * Every fallback in this form used to reach for the clip's own URL when the
 * real thumbnail was not at hand, and that value was then saved into
 * `videoThumbnailUrls`. In Discovery the poster failed to render, its error
 * marked the VIDEO as failed (same URL), and the whole post went to a broken
 * image over black — a video that looked crashed. No fallback may return the
 * video itself: an empty poster is always safe, a video URL never is.
 */
const isUsablePoster = (thumb: string | null | undefined, videoUrl: string): thumb is string => {
  if (!thumb || thumb.startsWith('blob:') || thumb === videoUrl) return false;
  return !/\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i.test(thumb);
};

/** Rejects anything longer than the platform maximum before a single byte is uploaded. */
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
  SKU: z.string().optional(),
  variations: z
    .array(
      z.object({
        name: z.string().min(1, { message: 'Every variation axis needs a name.' }),
        options: z.array(z.string().min(1, { message: 'Every variation option needs a value.' })),
        SKU: z.string().min(1, { message: 'Every variation needs a SKU.' }),
      }),
    )
    .max(50, { message: 'You can publish up to 50 variations.' })
    .refine(arr => arr.every(a => a.name.trim() !== ''), { message: 'Variation axis names cannot be empty.' })
    .refine(arr => arr.every(a => a.options.length >= 2), { message: 'Every variation axis needs at least 2 options.' }),
});

interface ProductUploadFormProps {
  productToEdit?: Product;
  onFormSubmit?: () => void;
  /**
   * Studio handoff: already-uploaded server URLs (e.g. a Classic Studio edit)
   * to pre-attach as the first photos. The studio saves its export through the
   * media pipeline first, so these are real stored URLs, not blobs — seeding
   * them here is what makes "Use in a product listing" actually attach the
   * edited photo instead of opening an empty tray.
   */
  initialImageUrls?: string[];
}

const STEPS = [
  { id: 0, label: 'Media', icon: ImageIcon, hint: 'Photos or a video — not both' },
  { id: 1, label: 'Details', icon: Tag, hint: 'Name it, describe it, tag it' },
  { id: 2, label: 'Price & Delivery', icon: Package, hint: 'Set your value, ship it' },
];

/** One media item the seller attaches to the listing: an image or a video, pre-validated. */
interface MediaItem {
  id: string;
  slot: number;
  kind: 'image' | 'video';
  /** Server URL once READY (image: webp; video: mp4). */
  url: string;
  /** Thumbnail for images, poster for videos. */
  thumbnailUrl?: string;
}

export function ProductUploadForm({ productToEdit, onFormSubmit, initialImageUrls }: ProductUploadFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  /** React Hook Form instance — the shape the zod resolver expects. */
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: productToEdit?.name ?? '',
      category: productToEdit?.category ?? '',
      condition: productToEdit?.condition ?? 'new',
      localCurrency: productToEdit?.localCurrency ?? 'KES',
      localPrice: Number(productToEdit?.localPrice ?? 0),
      price: Number(productToEdit?.price ?? 0),
      shippingCost: Number(productToEdit?.shippingCost ?? 0),
      stock: Number(productToEdit?.stock ?? 0),
      description: productToEdit?.description ?? '',
      tags: productToEdit?.tags ?? '',
      deliveryOptions: productToEdit?.deliveryOptions ?? '',
      wasPrice: productToEdit?.wasPrice ?? null,
      SKU: productToEdit?.SKU ?? '',
      variations: productToEdit?.variations?.map(v => ({ ...v, SKU: v.SKU ?? '' })) ?? [],
    },
  });

  const [step, setStep] = useState(0);
  const [showPricingCard, setShowPricingCard] = useState(true);
  const [imageSlots, setImageSlots] = useState<(File | null)[]>(new Array<File | null>(MAX_IMAGES).fill(null));
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(new Array<string | null>(MAX_IMAGES).fill(null));
  const [imageThumbUrls, setImageThumbUrls] = useState<(string | null)[]>(new Array<string | null>(MAX_IMAGES).fill(null));
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [videoPreviews, setVideoPreviews] = useState<string[]>([]);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>([]);
  const [videoThumbUrls, setVideoThumbUrls] = useState<string[]>([]);
  /**
   * Poster recorded per committed video URL. The picker's previews keep the
   * server URL after an upload, so when the same clip is walked again (step 0
   * uploads, submit re-runs the loop) the reuse branch must push the REAL
   * thumbnail for that URL — never the clip's own URL as its poster.
   */
  const videoPosterByUrl = useRef<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  const [SKU, setSKU] = useState<string | null>(productToEdit?.SKU ?? null);
  const [variations, setVariations] = useState<
    { name: string; options: string[]; SKU: string }[]
  >(productToEdit?.variations?.map(v => ({ ...v, SKU: v.SKU ?? '' })) ?? []);

  const [listingType, setListingType] = useState<'product' | 'service'>(
    productToEdit?.listingType === 'service' ? 'service' : 'product',
  );
  const [serviceCategory, setServiceCategory] = useState<string>(productToEdit?.serviceCategory ?? '');
  const [serviceArea, setServiceArea] = useState<string>(productToEdit?.serviceArea ?? '');
  const [priceMode, setPriceMode] = useState<string>(productToEdit?.priceMode ?? 'fixed');

  /*
   * Edit mode: seed the media picker with the media already attached to the
   * listing. Without this an edit opens with an empty photo tray and
   * publishing overwrites imageUrl/videoUrls with nothing.
   */
  /*
   * Studio handoff: seed the tray with the edited photos the studio already
   * stored. Runs once (guarded by the empty-slot check) so a later re-render
   * never clobbers photos the seller has since arranged.
   */
  useEffect(() => {
    if (!initialImageUrls?.length) return;
    const urls = initialImageUrls
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u): u is string => u !== '' && !u.startsWith('blob:'))
      .slice(0, MAX_IMAGES);
    setImagePreviews((prev) => prev.map((cur, i) => cur ?? urls[i] ?? null));
    setImageThumbUrls((prev) => prev.map((cur, i) => cur ?? urls[i] ?? null));
  }, [initialImageUrls]);

  useEffect(() => {
    if (!productToEdit) return;
    const clean = (list: (string | undefined | null)[] | undefined) =>
      (list ?? []).filter((u): u is string => typeof u === 'string' && u.trim() !== '');

    const images = clean(productToEdit.imageUrls);
    const primaryImage = productToEdit.imageUrl || images[0] || '';
    const allImages = (images.length ? images : primaryImage ? [primaryImage] : []).slice(0, MAX_IMAGES);
    const imageThumbs = clean(productToEdit.thumbnailUrls);
    setImagePreviews((prev) => prev.map((cur, i) => cur ?? allImages[i] ?? null));
    setImageThumbUrls((prev) => prev.map((cur, i) => cur ?? imageThumbs[i] ?? allImages[i] ?? null));

    const videos = clean(productToEdit.videoUrls);
    const primaryVideo = productToEdit.videoUrl || videos[0] || '';
    const allVideos = (videos.length ? videos : primaryVideo ? [primaryVideo] : []).slice(0, MAX_VIDEOS);
    const videoThumbs = clean(productToEdit.videoThumbnailUrls);
    setExistingVideoUrls((prev) => (prev.length ? prev : allVideos));
    setVideoThumbUrls((prev) =>
      prev.length ? prev : allVideos.map((url, i) => (isUsablePoster(videoThumbs[i], url) ? videoThumbs[i] : '')),
    );
  }, [productToEdit]);

  const descriptionValue = form.watch('description');
  const conditionValue = form.watch('condition');

  /* ------------------------------------------------------------------ */
  /* Quota — read once on mount, then live-check at publish time.      */
  /* ------------------------------------------------------------------ */
  const { quota, used, remaining, full: quotaFull, refetch } = useQuota();

  /* ------------------------------------------------------------------ */
  /* Media changes (single source of truth for what the seller picked). */
  /* ------------------------------------------------------------------ */
  const imageInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;
    // A listing is EITHER a set of photos OR a single video — never both.
    if (videoFiles.length > 0 || existingVideoUrls.length > 0) {
      toast({ variant: 'destructive', title: 'Photos or video, not both', description: 'This listing already has a video. Remove it before adding photos.' });
      return;
    }
    const newSlots = [...imageSlots];
    const newPreviews = [...imagePreviews];
    const newThumbs = [...imageThumbUrls];
    let added = 0;
    let rejected = 0;
    // One picker session can fill THIS slot plus every empty slot after it —
    // sellers were tapping ADD once per photo, which on a phone is the whole
    // reason "add more than one image" felt broken.
    for (const file of picked) {
      if (added >= MAX_IMAGES) break;
      if (!file.type.startsWith('image/')) {
        rejected++;
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        rejected++;
        continue;
      }
      let slot = -1;
      for (let s = index; s < MAX_IMAGES; s++) {
        if (newSlots[s] === null && !newPreviews[s]) { slot = s; break; }
      }
      if (slot === -1) break;
      newSlots[slot] = file;
      if (newPreviews[slot]?.startsWith('blob:')) URL.revokeObjectURL(newPreviews[slot]!);
      newPreviews[slot] = URL.createObjectURL(file);
      newThumbs[slot] = null;
      added++;
    }
    setImageSlots(newSlots);
    setImagePreviews(newPreviews);
    setImageThumbUrls(newThumbs);
    if (rejected > 0) {
      toast({
        variant: 'destructive',
        title: rejected === 1 ? 'Photo skipped' : `${rejected} photos skipped`,
        description: `Only JPG, PNG or WebP images up to ${MAX_IMAGE_SIZE_MB} MB fit, and a listing takes up to ${MAX_IMAGES}.`,
      });
    }
  };

  const removeImage = (index: number) => {
    if (imagePreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(imagePreviews[index]!);
    const newSlots = [...imageSlots];
    newSlots[index] = null;
    setImageSlots(newSlots);
    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
    const newThumbs = [...imageThumbUrls];
    newThumbs[index] = null;
    setImageThumbUrls(newThumbs);
  };

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    // A listing is EITHER a single video OR a set of photos — never both.
    const hasImages = imageSlots.some(slot => slot instanceof File) || imagePreviews.some(Boolean);
    if (hasImages) {
      toast({ variant: 'destructive', title: 'Video or photos, not both', description: 'This listing already has photos. Remove them before adding a video.' });
      event.target.value = '';
      return;
    }
    const hasRoom = videoFiles.length + existingVideoUrls.length < MAX_VIDEOS;
    if (!hasRoom) {
      toast({ variant: 'destructive', title: 'Video limit reached', description: `A product can have up to ${MAX_VIDEOS} video${MAX_VIDEOS === 1 ? '' : 's'}. Remove the current clip first.` });
      return;
    }
    const picked: File[] = Array.from(files);
    for (const file of picked) {
      if (!file.type.startsWith('video/')) {
        toast({ variant: 'destructive', title: 'Invalid file', description: `${file.name} is not a video.` });
        return;
      }
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Video too large', description: `${file.name} exceeds the ${MAX_VIDEO_SIZE_MB}MB limit.` });
        return;
      }
    }
    void (async () => {
      for (const file of picked) {
        const seconds = await videoDurationSeconds(file);
        if (seconds > MAX_VIDEO_SECONDS + 0.5) {
          toast({
            variant: 'destructive',
            title: 'Video too long',
            description: `${file.name} is ${Math.round(seconds / 60 * 10) / 10} min. The maximum is ${MAX_VIDEO_LABEL}.`,
          });
          return;
        }
      }
      setVideoFiles(prev => [...prev, ...picked]);
      const newPreviews = picked.map(f => URL.createObjectURL(f));
      setVideoPreviews(prev => [...prev, ...newPreviews]);
    })();
    event.target.value = '';
  };

  const removeVideo = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingVideoUrls(prev => prev.filter((_, i) => i !== index));
      setVideoThumbUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      if (videoPreviews[index]?.startsWith('blob:')) URL.revokeObjectURL(videoPreviews[index]!);
      setVideoFiles(prev => prev.filter((_, i) => i !== index));
      setVideoPreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const coverImage = useMemo(() => imagePreviews.find(p => !!p) || null, [imagePreviews]);

  /* ------------------------------------------------------------------ */
  /* Upload through the VPS media system, with server-side limits.     */
  /* ------------------------------------------------------------------ */
  const uploadViaVps = async (file: File, onPhase?: (p: UploadProgress) => void): Promise<{ url: string; thumbnailUrl?: string }> => {
    if (!user) throw new Error('You must be signed in to upload media.');
    const handle = uploadMedia(file, user, (p) => onPhase?.(p));
    const result = await handle.promise;
    if (result.phase === 'failed' || !result.url) {
      throw new Error(result.error || 'Media processing failed.');
    }
    return { url: result.url, thumbnailUrl: result.thumbnailUrl };
  };

  /**
   * Uploads every file still waiting in the picker and returns the complete,
   * final media lists for the listing. The server enforces the limit use of
   * REQUEST_MAX_IMAGES (8) and REQUEST_MAX_VIDEOS (8) per listing, so the
   * upload never has to guess: if the seller has attached more than eight,
   * the server rejects the whole batch and we stop on the first file that
   * would have crossed the ceiling.
   */
  const uploadPendingMedia = async (): Promise<{
    imageUrls: (string | null)[];
    imageThumbs: (string | null)[];
    videoUrls: string[];
    videoThumbs: string[];
  }> => {
    const imageUrls: (string | null)[] = new Array<string | null>(MAX_IMAGES).fill(null);
    const imageThumbs: (string | null)[] = new Array<string | null>(MAX_IMAGES).fill(null);
    const uploadedVideoUrls: string[] = [];
    const uploadedVideoThumbs: string[] = [];

    const pendingFiles = imageSlots.map((slot, index) => (slot instanceof File ? { slot, index } : null)).filter(Boolean) as { slot: File; index: number }[];
    const mediaIds = new Map<number, string>();
    const progressKeys = new Set<string>();
    /*
     * Photos upload THREE AT A TIME, not one after another. Each file is
     * already shrunk to a few hundred KB in the browser (see
     * compressImageForUpload in the media upload client), so the old serial
     * loop spent most of its time waiting on round trips — eight photos was
     * eight consecutive network waits. Three concurrent requests keep a phone
     * connection busy without hammering the VPS, and every slot keeps its own
     * progress bar and its own failure message.
     *
     * Slots already uploaded in a previous (failed-then-Continued) pass are
     * not in `pendingFiles` — their URLs are kept, exactly as before — so a
     * retry only sends what is still missing.
     */
    const CONCURRENCY = 3;
    let cursor = 0;
    let firstError: Error | null = null;

    const uploadOne = async ({ slot, index }: { slot: File; index: number }) => {
      const key = `img-${index}`;
      setUploadProgress(prev => ({ ...prev, [key]: 0 }));
      progressKeys.add(key);
      try {
        const { url, thumbnailUrl } = await uploadViaVps(slot, (p) =>
          setUploadProgress(prev => ({ ...prev, [key]: p.percent })),
        );
        imageUrls[index] = url;
        imageThumbs[index] = thumbnailUrl || url;
        setImagePreviews(prev => { const next = [...prev]; next[index] = url; return next; });
        setImageThumbUrls(prev => { const next = [...prev]; next[index] = thumbnailUrl || url; return next; });
        setImageSlots(prev => { const next = [...prev]; next[index] = null; return next; });
        mediaIds.set(index, '');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        // Keep the FIRST failure — it names the photo that needs attention.
        firstError ??= new Error(`Photo ${index + 1}: ${message}`);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pendingFiles.length) }, async () => {
        while (cursor < pendingFiles.length && !firstError) {
          const next = pendingFiles[cursor++];
          if (!next) break;
          await uploadOne(next);
        }
      }),
    );
    if (firstError) throw firstError;

    for (let i = 0; i < videoFiles.length; i++) {
      // Already uploaded in a previous step — reuse the stored URL instead of
      // sending the same bytes to the server twice.
      const committedPreview = videoPreviews[i];
      if (committedPreview && !committedPreview.startsWith('blob:')) {
        uploadedVideoUrls.push(committedPreview);
        // Reuse the poster recorded when this exact URL was uploaded (empty
        // string = none) — pushing the clip's own URL here is what used to
        // save an .mp4 as the listing's poster and crash its feed card.
        uploadedVideoThumbs.push(videoPosterByUrl.current[committedPreview] ?? '');
        continue;
      }
      const file = videoFiles[i];
      const key = `vid-${i}`;
      setUploadProgress(prev => ({ ...prev, [key]: 0 }));
      try {
        const { url, thumbnailUrl } = await uploadViaVps(file, (p) =>
          setUploadProgress(prev => ({ ...prev, [key]: p.percent })),
        );
        videoPreviews[i] && URL.revokeObjectURL(videoPreviews[i]);
        setVideoPreviews(prev => {
          const next = [...prev];
          next[i] = url;
          return next;
        });
        uploadedVideoUrls.push(url);
        // A missing thumbnail yields an empty poster (safe) — never the video
        // URL, which cannot render as an image.
        videoPosterByUrl.current[url] = thumbnailUrl || '';
        uploadedVideoThumbs.push(thumbnailUrl || '');
        mediaIds.set(i, '');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        throw new Error(`Video ${i + 1}: ${message}`);
      }
    }

    setUploadProgress({});
    return { imageUrls, imageThumbs, videoUrls: uploadedVideoUrls, videoThumbs: uploadedVideoThumbs };
  };

  const validateStep = async (s: number): Promise<boolean> => {
    if (s === 0) {
      const hasVideo = videoFiles.length > 0 || existingVideoUrls.length > 0;
      const imageCount = imagePreviews.filter(Boolean).length;
      // A listing is EITHER 1..8 photos OR a single video — never both.
      if (hasVideo) {
        if (imageCount > 0) {
          toast({
            variant: 'destructive',
            title: 'Photos or video, not both',
            description: 'Remove the photos to keep the video, or remove the video to keep the photos.',
          });
          return false;
        }
        return true;
      }
      if (imageCount < MIN_IMAGES_PER_LISTING) {
        toast({
          variant: 'destructive',
          title: imageCount === 0 ? 'Add at least one photo' : `Add ${MIN_IMAGES_PER_LISTING - imageCount} more photo${MIN_IMAGES_PER_LISTING - imageCount === 1 ? '' : 's'}`,
          description: 'Listings with photos get 5× more views.',
        });
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
    if (!(await validateStep(step))) return;
    if (step === 0) {
      if (quotaFull) {
        toast({
          variant: 'destructive',
          title: 'Media limit reached',
          description: `You have used all ${quota} media items across your listings. Delete something you no longer need, or upgrade for more space.`,
        });
        return;
      }
      if (imageSlots.some(f => f instanceof File) || videoFiles.length > 0) {
        setIsUploading(true);
        setUploadProgress({});
        try {
          await uploadPendingMedia();
        } catch (error: any) {
          console.warn('[Media upload failed]', error);
          toast({ variant: 'destructive', title: 'Upload failed', description: error.message || 'Something interrupted the upload. Try again.' });
          return;
        } finally {
          setIsUploading(false);
        }
      }
    }
    setStep(s => Math.min(2, s + 1));
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isUploading) return;
    if (!(await validateStep(0))) return;
    if (!(await validateStep(1))) return;
    if (!user) {
      toast({ variant: 'destructive', title: 'Session Expired', description: 'Please sign in to continue.' });
      return;
    }
    if (quotaFull) {
      toast({
        variant: 'destructive',
        title: 'Media limit reached',
        description: `You have used all ${quota} media items across your listings. Delete something you no longer need, or upgrade for more space.`,
      });
      return;
    }
    setIsUploading(true);
    setUploadProgress({});
    try {
      const media = await uploadPendingMedia();
      /*
       * Saved media = everything already attached (seeded from the listing in
       * edit mode, or uploaded on an earlier step) PLUS the files just sent in
       * this submit. uploadPendingMedia() only reports files that were still
       * pending in the picker, so building the saved lists from it alone
       * silently drops every previously attached photo/video.
       */
      const finalImageUrls: string[] = [];
      const finalImageThumbs: string[] = [];
      const pushImage = (url: string, thumb?: string | null) => {
        if (!url || url.startsWith('blob:') || finalImageUrls.includes(url)) return;
        finalImageUrls.push(url);
        finalImageThumbs.push(thumb || url);
      };
      imagePreviews.forEach((url, i) => {
        if (url) pushImage(url, imageThumbUrls[i]);
      });
      media.imageUrls.forEach((url, i) => {
        if (url) pushImage(url, media.imageThumbs[i]);
      });

      const finalVideoUrls: string[] = [];
      const finalVideoThumbs: string[] = [];
      const pushVideo = (url: string, thumb?: string | null) => {
        if (!url || url.startsWith('blob:') || finalVideoUrls.includes(url)) return;
        finalVideoUrls.push(url);
        // Same rule as everywhere else: the poster is the real thumbnail when
        // we have one, and '' when we do not — never the video URL itself.
        finalVideoThumbs.push(isUsablePoster(thumb, url) ? thumb : '');
      };
      existingVideoUrls.forEach((url, i) => pushVideo(url, videoThumbUrls[i]));
      media.videoUrls.forEach((url, i) => pushVideo(url, media.videoThumbs[i]));

      const productData: any = {
        ...values,
        listingType,
        ...(listingType === 'service' ? { serviceCategory, serviceArea, priceMode } : {}),
        ...(listingType === 'service' && priceMode === 'quote' ? { price: 0, localPrice: 0, shippingCost: 0 } : {}),
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
        mirrorProduct(user, productToEdit.id);
        toast({ title: 'Listing updated', description: 'Your changes are live with optimized media.' });
      } else {
        const created = await addDoc(collection(firestore, 'products'), {
          ...productData,
          sellerId: user.uid,
          uploadDate: serverTimestamp(),
          likes: 0,
          viewCount: 0,
          inCartCount: 0,
          salesCount: 0,
        });
        mirrorProduct(user, created.id);
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
      console.warn('[Upload failed]', error);
      toast({ variant: 'destructive', title: 'Upload failed', description: error.message || 'Something interrupted the upload. Try again.' });
    } finally {
      setIsUploading(false);
    }
  }

  const onInvalid = (errors: any) => {
    const firstError = Object.values(errors)[0] as any;
    toast({ variant: 'destructive', title: 'Almost there', description: firstError?.message || 'Check the highlighted fields.' });
    if (errors.name || errors.category || errors.condition || errors.description) setStep(1);
    else if (errors.price || errors.stock || errors.deliveryOptions) setStep(2);
  };

  const inputCls = 'h-12 rounded-xl border-border bg-background/60 focus-visible:ring-primary/30 focus-visible:border-primary/50';
  const mediaUploading = Object.values(uploadProgress);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
      <div>
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
                      {MAX_IMAGES} photos OR 1 video — not both. Add 1 to {MAX_IMAGES} photos, or a single {MAX_VIDEO_LABEL} clip. We auto-compress everything to WebP/H.264 on your VPS — originals are never kept.
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
                      <input type="file" className="hidden" ref={el => { imageInputRefs.current[i] = el; }} accept="image/*" multiple onChange={(e) => handleImageChange(i, e)} />
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
                <p className="text-sm text-muted-foreground mt-1 mb-5">MP4 or WebM · up to {MAX_VIDEOS} clip{MAX_VIDEOS === 1 ? '' : 's'} · {MAX_VIDEO_SIZE_MB}MB each · maximum {MAX_VIDEO_LABEL}, compressed to 720p automatically. Seller uploads run through the Vidnov media engine on your own server, not a third-party upload service.</p>
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
                <Button type="button" onClick={goNext} disabled={isUploading} className="h-12 px-8 rounded-xl font-semibold vn-shadow-glow">
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading media…</>
                  ) : (
                    <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>

                {isUploading && mediaUploading.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {(() => {
                      return Object.entries(uploadProgress).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                          <span className="min-w-0 truncate">{key}</span>
                          <div className="flex-1 h-1 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${Math.min(100, value)}%` }} />
                          </div>
                          <span className="shrink-0 tabular-nums">{Math.round(value)}%</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
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

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">What are you listing?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(() => (
                      [
                        { key: 'product', title: 'A product', hint: 'Something to buy and have delivered' },
                        { key: 'service', title: 'A service', hint: 'Work you do — no delivery needed' },
                      ] as const
                    ).map(opt => (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => setListingType(opt.key)}
                        aria-pressed={listingType === opt.key}
                        className={cn(
                          'rounded-xl border p-3 text-left transition',
                          listingType === opt.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
                        )}
                      >
                        <p className="text-sm font-semibold">{opt.title}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                      </button>
                    )))()}
                  </div>
                </div>

                {listingType === 'service' && (
                  <div className="space-y-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className="text-xs text-muted-foreground">
                      Services trade in the same feed, shop and checkout as products. If your trade is not listed, pick &ldquo;Other services&rdquo; and name it in the description — we would rather you could sell than sit behind a missing category.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Trade</Label>
                        <Select value={serviceCategory} onValueChange={setServiceCategory}>
                          <SelectTrigger className={inputCls}><SelectValue placeholder="Choose a trade" /></SelectTrigger>
                          <SelectContent>{SERVICE_CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How do you charge?</Label>
                        <Select value={priceMode} onValueChange={(v) => setPriceMode(v as 'quote' | 'hourly' | 'fixed')}>
                          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                          <SelectContent>{PRICE_MODES.map(m => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Where will you work?</Label>
                      <Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Westlands, Nairobi — or remote across Kenya" className={inputCls} />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{listingType === 'service' ? 'Service name' : 'Product name'}</Label>
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
                            conditionValue === c ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background/60 text-muted-foreground hover:border-foreground/20',
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
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">USD value</Label>
                    <Input type="number" step="0.01" min="0" className={cn(inputCls, 'bg-[#111625] text-white')} placeholder="0.00" {...form.register('price')} />
                    {form.formState.errors.price && <p className="text-xs text-destructive">{form.formState.errors.price.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Was price</Label>
                    <Input type="number" placeholder="Optional" className={cn(inputCls, 'bg-[#111625] text-white')} {...form.register('wasPrice')} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Stock</Label>
                  <Input type="number" className={inputCls} {...form.register('stock')} />
                  {form.formState.errors.stock && <p className="text-xs text-destructive">{form.formState.errors.stock.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Delivery</Label>
                  <Textarea
                    rows={3}
                    className="rounded-xl border-border bg-background/60 resize-none focus-visible:ring-primary/30 focus-visible:border-primary/50"
                    placeholder="How will the item travel?"
                    {...form.register('deliveryOptions')}
                  />
                  {form.formState.errors.deliveryOptions && <p className="text-xs text-destructive">{form.formState.errors.deliveryOptions.message}</p>}
                </div>

                <div className="flex justify-end">
                  <Button type="submit" className="h-12 px-8 rounded-xl font-semibold vn-shadow-glow">Publish listing</Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* ============ SIDEBAR ============ */}
      <div className="xn-sidebar space-y-4">
        <div className="xn-card rounded-2xl border border-border bg-card p-4">
          <h4 className="xn-card-title text-sm font-semibold">Media used</h4>
          {quota ? (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total attached</span>
                <span className={cn('text-[10px] font-black uppercase tracking-widest', quotaFull ? 'text-red-400' : used / quota > 0.8 ? 'text-amber-400' : 'text-cyan-400')}>
                  {used} / {quota}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn('h-full rounded-full transition-all', quotaFull ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-violet-500')}
                  style={{ width: `${Math.min(100, (used / Math.max(1, quota)) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {quotaFull
                  ? `You have used all ${quota} media items. Delete an item you no longer need, or upgrade for more space.`
                  : `${quota - used} left. Photos and videos both count.`}
              </p>
            </>
          ) : (
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Attached media count toward your free {SELLER_MEDIA_QUOTA_FREE}-item quota after the listing publishes. Uploads still run through the Vidnov media engine, which enforces the per-listing cap of {MAX_IMAGES} images and {MAX_VIDEOS} video{MAX_VIDEOS === 1 ? '' : 's'} on the server.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
