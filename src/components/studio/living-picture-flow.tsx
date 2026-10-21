'use client';

/**
 * LIVING PICTURES — creation flow (spec §B1).
 *
 * A Living Picture is a still photo published with OPTIONAL licensed music.
 * This flow:
 *   1. takes an already-edited studio photo (or lets the seller pick one),
 *   2. asks "regular photo" or "Living Picture",
 *   3. for a Living Picture, offers an OPTIONAL "Add Music" step driven by the
 *      licensing-gated catalogue (`music-catalog.ts`). With no licensed tracks
 *      the step is clearly labelled unavailable — nothing is fabricated,
 *   4. previews the finished picture with its playback control,
 *   5. publishes through the EXISTING pipeline: it writes a `products` document
 *      (same collection, same moderation/ownership/privacy rules) with additive
 *      fields, so a Living Picture is discoverable in the feed and links back to
 *      the seller — WITHOUT creating a parallel system or a duplicate listing.
 *
 * Music is never required: a Living Picture with no track is valid, and an
 * ordinary photo never gains a play control.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Disc3, Image as ImageIcon, Loader2, Music2, Sparkles, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { uploadMedia } from '@/lib/media/upload-client';
import { catalogueAvailability, listAvailableTracks, type CatalogueTrack } from '@/lib/studio/music-catalog';
import { LivingPicturePlayer, type LivingPictureTrack } from '@/components/studio/living-picture-player';
import { cn } from '@/lib/utils';

type PublishMode = 'photo' | 'living';

export function LivingPictureFlow({ initialImage }: { initialImage?: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [image, setImage] = React.useState<string>(initialImage ?? '');
  const [mode, setMode] = React.useState<PublishMode>('living');
  const [track, setTrack] = React.useState<CatalogueTrack | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('0');
  const [stock, setStock] = React.useState('1');
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [previewFailed, setPreviewFailed] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // If the studio handed us a photo, keep the flow in sync when the prop lands.
  React.useEffect(() => {
    if (initialImage) setImage(initialImage);
  }, [initialImage]);

  const availability = catalogueAvailability();
  const tracks = React.useMemo(() => listAvailableTracks(), []);

  const pickImage = React.useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Not an image', description: 'Choose a JPG, PNG or WebPhoto.' });
        return;
      }
      const url = URL.createObjectURL(file);
      // Upload immediately through the real pipeline so the published doc
      // references a stored server URL, not a transient blob.
      uploadMedia(file, user).promise
        .then((res) => {
          URL.revokeObjectURL(url);
          if (res.phase === 'failed' || !res.url) throw new Error(res.error || 'Upload failed.');
          setImage(res.url);
        })
        .catch((err: unknown) => {
          URL.revokeObjectURL(url);
          toast({
            variant: 'destructive',
            title: 'Upload failed',
            description: err instanceof Error ? err.message : 'Could not upload the photo.',
          });
        });
    },
    [user, toast],
  );

  const trackPreview: LivingPictureTrack | null =
    mode === 'living' && track
      ? { id: track.id, title: track.title, artist: track.artist, streamUrl: track.streamUrl, durationSeconds: track.durationSeconds }
      : null;

  const canPublish =
    !!image && !!name.trim() && !!user && !isPublishing && (mode === 'photo' || !availability.available || true);

  const publish = React.useCallback(async () => {
    if (!user || !firestore) return;
    if (!image) {
      toast({ variant: 'destructive', title: 'Add a photo', description: 'A Living Picture needs a photo first.' });
      return;
    }
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Give it a name', description: 'Buyers need to know what this is.' });
      return;
    }
    // A selected track must still be licensed at publish time — the licence
    // could have lapsed between selection and this tap.
    if (mode === 'living' && track) {
      const still = listAvailableTracks().some((t) => t.id === track.id);
      if (!still) {
        toast({ variant: 'destructive', title: 'Track no longer available', description: 'Pick another licensed track, or publish without music.' });
        setTrack(null);
        return;
      }
    }

    setIsPublishing(true);
    try {
      const parsedPrice = Math.max(0, Number(price) || 0);
      const parsedStock = Math.max(0, Math.floor(Number(stock) || 0));
      const living = mode === 'living';

      const doc: Record<string, unknown> = {
        sellerId: user.uid,
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        localPrice: parsedPrice,
        localCurrency: 'KES',
        stock: parsedStock,
        category: 'living-picture',
        // Additive markers. An ordinary photo simply omits these, which is how
        // Discovery tells an ordinary photo, a Living Picture and a video apart.
        imageUrl: image,
        imageUrls: [image],
        thumbnailUrls: [image],
        mediaKind: living ? 'livingPicture' : 'photo',
        uploadDate: serverTimestamp(),
        likes: 0,
        viewCount: 0,
        inCartCount: 0,
        salesCount: 0,
      };

      if (living && track) {
        doc.musicTrack = {
          id: track.id,
          title: track.title,
          artist: track.artist,
          streamUrl: track.streamUrl,
          licenceId: track.licence.licenceId,
          licensor: track.licence.licensor,
        };
      }

      const created = await addDoc(collection(firestore, 'products'), doc);
      toast({
        title: living ? 'Living Picture published' : 'Photo published',
        description: living && !track ? 'Published as a Living Picture with no music.' : 'It is live in your shop and Discovery.',
      });
      router.push('/app/seller/products');
      return created.id;
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      setIsPublishing(false);
    }
  }, [user, firestore, image, name, description, price, stock, mode, track, toast, router]);

  return (
    <div className="space-y-4">
      {/* Photo */}
      <section className="space-y-2">
        <Label>Photo</Label>
        {image ? (
          <div className="relative overflow-hidden rounded-2xl border border-border" style={{ aspectRatio: '1 / 1' }}>
            <LivingPicturePlayer
              imageUrl={image}
              alt={name || 'Living picture preview'}
              track={trackPreview}
              onError={setPreviewFailed}
            />
            <button
              type="button"
              onClick={() => setImage('')}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center"
          >
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
            <span className="mt-2 text-sm font-semibold">Choose a photo</span>
            <span className="mt-1 text-xs text-muted-foreground">
              Or start from Classic Studio for a polished edit.
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickImage(f);
            e.target.value = '';
          }}
        />
        {previewFailed && (
          <p className="text-[11px] text-amber-500">{previewFailed}</p>
        )}
      </section>

      {/* Mode */}
      <section className="space-y-2">
        <Label>How to publish</Label>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === 'photo'}
            onClick={() => setMode('photo')}
            icon={ImageIcon}
            title="Regular photo"
            body="A still image. No music."
          />
          <ModeCard
            active={mode === 'living'}
            onClick={() => setMode('living')}
            icon={Video}
            title="Living Picture"
            body="A still photo with optional music."
          />
        </div>
      </section>

      {/* Music (Living Picture only) */}
      {mode === 'living' && (
        <section className="space-y-2 rounded-2xl border border-border p-3">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-primary" />
            <Label className="mb-0">Add music (optional)</Label>
          </div>

          {!availability.available ? (
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-[12px] font-semibold">Music not available yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{availability.reason}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                You can still publish this Living Picture without music.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTrack((cur) => (cur?.id === t.id ? null : t))}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left',
                    track?.id === t.id ? 'border-primary bg-primary/10' : 'border-border',
                  )}
                >
                  <span className="text-[12px] font-semibold">{t.title}</span>
                  <span className="text-[11px] text-muted-foreground">{t.artist}</span>
                </button>
              ))}
              {track && (
                <Button variant="ghost" size="sm" onClick={() => setTrack(null)}>
                  <X className="mr-1 h-3 w-3" /> Remove track
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Details */}
      <section className="space-y-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Handmade leather tote" />
        </div>
        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes it special?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Price (KSh)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Stock</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
        </div>
      </section>

      <Button onClick={publish} disabled={!canPublish} className="w-full">
        {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {isPublishing ? 'Publishing…' : mode === 'living' ? 'Publish Living Picture' : 'Publish photo'}
      </Button>

      {!availability.available && mode === 'living' && (
        <p className="text-center text-[11px] text-muted-foreground">
          <Disc3 className="mr-1 inline h-3 w-3" />
          Publishing with no music is fully supported.
        </p>
      )}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon: Icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-xl border p-3 text-left',
        active ? 'border-primary bg-primary/10' : 'border-border',
      )}
    >
      <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
      <span className="text-[12px] font-semibold">{title}</span>
      <span className="text-[10px] text-muted-foreground">{body}</span>
    </button>
  );
}
