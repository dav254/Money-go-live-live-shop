'use client';

import * as React from 'react';
import type { User } from 'firebase/auth';
import { Image as ImageIcon, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { doc, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { SellerCard } from '@/components/app/seller/seller-app-shell';
import { uploadMedia } from '@/lib/media/upload-client';
import { IMAGE_LIMITS } from '@/lib/media/limits';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * SHOP BRANDING (`/app/seller/account`).
 *
 * ## Why this is its own component
 *
 * Logo and banner used to sit in a two-column grid inside "Your shop", next to
 * a text field, and the result was that the single most visual part of the
 * product had the least room to explain itself. Worse, the uploaded URL only
 * reached Firestore when the seller also pressed **Save shop** — so an image
 * that uploaded successfully vanished if they scrolled away, which reads
 * exactly like "the upload refused". It is split out here so:
 *
 *   1. the preview shows the real arrangement — banner behind, logo in front,
 *      overlapping the edge — so a seller can judge it before buyers see it;
 *   2. each image is written to Firestore the moment it finishes uploading,
 *      with no second button to forget;
 *   3. a failure says what failed, instead of one blanket "try a smaller
 *      image" for every possible cause.
 *
 * ## Where the bytes go — our own disk, not Firebase Storage
 *
 * This used to call `uploadBytes(ref(storage, …))` and returned a
 * `firebasestorage.app` URL. That is a paid, quota-limited third-party bucket
 * shared by every seller on the platform, and when it filled up every branding
 * upload failed with `storage/quota-exceeded` — which is exactly what happened.
 *
 * `uploadMedia()` posts to `/api/media/upload` instead: the file is written to
 * the VPS disk under `/var/lib/vidnov/media`, re-encoded to WebP at
 * `MEDIA_CONFIG.IMAGE_QUALITY` and capped at `IMAGE_MAX_DIMENSION`, with a
 * thumbnail alongside it. Same product images already worked this way — this
 * screen was the outlier.
 *
 * ## Why the Firestore write is a batch
 *
 * `sellerShops.logoUrl` and `userProfiles.profilePictureUrl` are read by
 * different screens (the storefront and the app list). Writing them together
 * means a buyer can never see a new logo in one place and the old one in
 * another. Note that neither write may carry `followers` —
 * `firestore.rules` rejects any update to a `sellerShops` document that
 * includes it.
 */

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif';

function describeUploadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/quota/i.test(message)) {
    return 'The server ran out of disk space. Ask support to clear space.';
  }
  if (/too large|exceeds/i.test(message)) {
    return `That image is over the ${IMAGE_LIMITS.maxUploadMb} MB limit.`;
  }
  return message || 'Upload failed. Check your connection and try again.';
}

export interface ShopBrandingSectionProps {
  user: User;
  firestore: Firestore;
  logoUrl: string;
  bannerUrl: string;
  /** Called after a successful write so the page state matches what was saved. */
  onChange: (patch: { logoUrl?: string; bannerUrl?: string }) => void;
}

export function ShopBrandingSection({
  user,
  firestore,
  logoUrl,
  bannerUrl,
  onChange,
}: ShopBrandingSectionProps) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<'logo' | 'banner' | null>(null);
  const [progress, setProgress] = React.useState(0);

  /**
   * One image, start to finished: validate, upload, compress, persist, report.
   *
   * `uploadMedia` resolves when the server reports READY, which is after the
   * WebP re-encode — so the URL written to Firestore is already the compressed
   * one and never a temporary.
   */
  const upload = React.useCallback(
    async (file: File, kind: 'logo' | 'banner') => {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'That is not an image',
          description: 'Choose a PNG, JPEG, WebP or GIF file.',
        });
        return;
      }
      // Caught here rather than on the server so the seller is not made to
      // upload 30 MB of mobile data only to be rejected at the end.
      if (file.size > IMAGE_LIMITS.maxUploadMb * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'That image is too large',
          description: `${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${IMAGE_LIMITS.maxUploadMb} MB.`,
        });
        return;
      }

      setBusy(kind);
      setProgress(0);
      try {
        const result = await uploadMedia(file, user, (p) => {
          if (typeof p.percent === 'number') setProgress(p.percent);
        }).promise;

        if (result.phase === 'failed' || !result.url) {
          toast({
            variant: 'destructive',
            title: kind === 'logo' ? 'Logo upload failed' : 'Banner upload failed',
            description: describeUploadError(result.error),
          });
          return;
        }

        const url = result.url;

        // Persist immediately. Nothing else on this screen is required for the
        // image to survive leaving the page.
        const patch = kind === 'logo' ? { logoUrl: url } : { bannerUrl: url };
        const batch = writeBatch(firestore);
        batch.set(doc(firestore, 'sellerShops', user.uid), patch, { merge: true });
        if (kind === 'logo') {
          batch.set(
            doc(firestore, 'userProfiles', user.uid),
            { profilePictureUrl: url },
            { merge: true },
          );
        }
        await batch.commit();

        onChange(patch);
        toast({
          title: kind === 'logo' ? 'Logo saved' : 'Banner saved',
          description:
            'Compressed and stored on our own server, not an external one. Open My shop to see it.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: kind === 'logo' ? 'Logo upload failed' : 'Banner upload failed',
          description: describeUploadError(error),
        });
      } finally {
        setBusy(null);
        setProgress(0);
      }
    },
    [firestore, onChange, toast, user],
  );

  /** Removing writes `null` rather than `''` so the field stops being a string. */
  const clear = React.useCallback(
    async (kind: 'logo' | 'banner') => {
      setBusy(kind);
      try {
        const patch = kind === 'logo' ? { logoUrl: null } : { bannerUrl: null };
        const batch = writeBatch(firestore);
        batch.set(doc(firestore, 'sellerShops', user.uid), patch, { merge: true });
        if (kind === 'logo') {
          batch.set(
            doc(firestore, 'userProfiles', user.uid),
            { profilePictureUrl: null },
            { merge: true },
          );
        }
        await batch.commit();
        onChange({ [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: '' });
        toast({ title: kind === 'logo' ? 'Logo removed' : 'Banner removed' });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Could not remove the image',
          description: 'The link was cleared but the file is still on disk.',
        });
      } finally {
        setBusy(null);
      }
    },
    [firestore, onChange, toast, user.uid],
  );

  return (
    <section className="px-4">
      <SellerCard className="vn-app-card space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Shop branding</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Your logo and banner. They save the moment they finish uploading — there is
              nothing else to press. This is the exact arrangement buyers see: banner
              behind, logo in front.
            </p>
          </div>
        </div>

        {/* ── Live preview: the storefront arrangement, at a glance ─────────── */}
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-neutral-950">
          <div className="relative h-28 w-full">
            {bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-500" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
          </div>
          <div className="-mt-9 flex flex-col items-center pb-3 text-center">
            <span className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-neutral-950 bg-secondary shadow-xl">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-black text-muted-foreground">?</span>
              )}
            </span>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {bannerUrl && logoUrl ? 'Ready to publish' : 'Add both to complete'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ImageSlot
            kind="logo"
            label="Logo"
            hint="Square works best — it is shown as a circle."
            src={logoUrl}
            busy={busy === 'logo'}
            progress={busy === 'logo' ? progress : null}
            round
            onPick={(file) => void upload(file, 'logo')}
            onClear={() => void clear('logo')}
          />
          <ImageSlot
            kind="banner"
            label="Banner"
            hint="Wide — roughly 3:1. This sits behind your logo."
            src={bannerUrl}
            busy={busy === 'banner'}
            progress={busy === 'banner' ? progress : null}
            onPick={(file) => void upload(file, 'banner')}
            onClear={() => void clear('banner')}
          />
        </div>
      </SellerCard>
    </section>
  );
}

function ImageSlot({
  kind,
  label,
  hint,
  src,
  busy,
  progress,
  round,
  onPick,
  onClear,
}: {
  kind: 'logo' | 'banner';
  label: string;
  hint: string;
  src: string;
  busy: boolean;
  /** 0-100 while uploading; null when idle. */
  progress: number | null;
  round?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          // Reset so picking the same file twice still fires `change`.
          e.target.value = '';
        }}
      />

      <div className="relative mt-1.5">
        {src ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              'group relative block w-full overflow-hidden border border-border disabled:opacity-60',
              round ? 'h-28 w-28 rounded-full' : 'aspect-[3/1] w-full rounded-xl',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 transition group-hover:opacity-100">
              Replace
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              'flex items-center justify-center border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60',
              round ? 'h-28 w-28 rounded-full' : 'aspect-[3/1] w-full rounded-xl',
            )}
          >
            {busy ? (
              <span className="flex flex-col items-center gap-1.5">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  {progress === 100 ? 'Compressing' : `${progress ?? 0}%`}
                </span>
              </span>
            ) : (
              <span className="flex flex-col items-center gap-1">
                <UploadCloud className="h-5 w-5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Upload</span>
              </span>
            )}
          </button>
        )}

        {src && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            aria-label={`Remove ${kind}`}
            className={cn(
              'absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white transition hover:bg-destructive disabled:opacity-60',
              round && '-right-1 -top-1',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}