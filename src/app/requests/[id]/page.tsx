'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useUserProfile, useFirestore } from '@/firebase';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { SellerLayout } from '@/components/layout/seller-layout';
import { AdminLayout } from '@/components/layout/admin-layout';
import { resolveRole, type AppRole } from '@/lib/auth/roles';
import {
  fetchRequestDetail,
  fetchOffersForRequest,
  requestAction,
  withdrawOffer,
  privateMediaUrl,
} from '@/lib/requests/client';
import type { OfferWithMedia } from '@/lib/requests/client';
import type { MarketplaceRequest } from '@/lib/requests/types';
import { budgetLabel } from '@/lib/requests/labels';
import { ensureChatWith } from '@/lib/requests/ensure-chat';
import { MediaViewerGrid } from '@/components/marketplace/media-viewer';
import {
  MarketplaceMediaUploader,
  type AttachedMedia,
} from '@/components/marketplace/media-uploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/app/buyer/requests/status-badge';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Paperclip,
  Eye,
  MessageSquareText,
  Send,
  CheckCircle2,
  Lock,
  Store,
  CalendarDays,
  MapPin,
  Truck,
} from 'lucide-react';

/**
 * Request detail (spec §30, §32, §37).
 * - Customer: attachments grid + compare offers + accept → order.
 * - Authorized seller: brief + private media viewer + offer form with media.
 * - Unauthorized viewer: brief only, media locked (§32).
 *
 * Requests are a SHARED surface, so the surrounding chrome follows the viewer:
 * sellers land in the merchant workspace (`/requests`), customers in the buyer
 * workspace (`/buyer/requests`). Back buttons must respect that too, otherwise
 * a seller is dumped into the buyer request section.
 */
function RoleLayout({ role, children }: { role: AppRole | null; children: React.ReactNode }) {
  if (role === 'seller') return <SellerLayout>{children}</SellerLayout>;
  if (role === 'admin') return <AdminLayout>{children}</AdminLayout>;
  return <BuyerLayout>{children}</BuyerLayout>;
}
export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { user, isLoading: authLoading } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const role = resolveRole(userProfile);
  // Where "back to requests" goes: sellers/resellers/admin keep their own
  // workspace, customers return to the buyer request list.
  const requestsHome = role === 'seller' || role === 'admin' || role === 'reseller' ? '/requests' : '/buyer/requests';
  const firestore = useFirestore();
  const router = useRouter();

  const [request, setRequest] = React.useState<MarketplaceRequest | null>(null);
  const [media, setMedia] = React.useState<{ mediaId: string; type: 'image' | 'video'; originalName?: string }[]>([]);
  const [mediaAuthorized, setMediaAuthorized] = React.useState(false);
  const [offers, setOffers] = React.useState<OfferWithMedia[] | null>(null);
  const [myOffer, setMyOffer] = React.useState<OfferWithMedia | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [accepting, setAccepting] = React.useState<string | null>(null);

  const isOwner = !!user && request?.customerId === user.uid;
  const isSellerView = !!user && !isOwner;

  React.useEffect(() => {
    if (!user || !id) return;
    let alive = true;
    (async () => {
      try {
        const detail = await fetchRequestDetail(user, id);
        if (!alive) return;
        setRequest(detail.request);
        setMediaAuthorized(detail.mediaAuthorized);
        setMedia(detail.media ?? []);
        if (detail.mediaAuthorized) void fetchOffers(user, id);
        else setOffers([]);
        // Sellers: restore an in-flight draft/submitted offer so returning
        // to the page shows their existing offer instead of "Take request".
        const mine = await requestAction(user, 'my-offer', id);
        if (alive && mine?.offer) setMyOffer(mine.offer as OfferWithMedia);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load request.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  async function fetchOffers(u: NonNullable<typeof user>, requestId: string) {
    try {
      const rows = await fetchOffersForRequest(u, requestId);
      if (aliveGuard.current) setOffers(rows);
    } catch {
      if (aliveGuard.current) setOffers([]);
    }
  }

  // Small ref so the nested fetch can respect the effect cleanup.
  const aliveGuard = React.useRef(true);
  React.useEffect(() => {
    aliveGuard.current = true;
    return () => {
      aliveGuard.current = false;
    };
  }, []);

  /**
   * Accept the winning offer: the request closes automatically, other
   * offers are declined server-side, and the buyer lands in Messages with
   * the winning seller so coordination starts immediately.
   */
  async function accept(offerId: string) {
    if (!user || !request) return;
    const offer = (offers ?? []).find((o) => o.id === offerId);
    setAccepting(offerId);
    try {
      await requestAction(user, 'accept', request.id ?? id, { offerId });
      // Open (or reuse) a direct chat with the winning seller.
      if (firestore && offer?.sellerId) {
        await ensureChatWith(firestore, user.uid, offer.sellerId);
        router.push(`/messages?chatWith=${offer.sellerId}`);
      } else {
        router.push(requestsHome);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept the offer.');
      setAccepting(null);
    }
  }

  /** Start a conversation with a seller from an offer card. */
  async function messageSeller(sellerId: string) {
    if (!user || !firestore) return;
    try {
      await ensureChatWith(firestore, user.uid, sellerId);
      router.push(`/messages?chatWith=${sellerId}`);
    } catch {
      setError('Could not open the conversation. Try again.');
    }
  }

  if (authLoading || loading) {
    return (
      <RoleLayout role={role}>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading request…
        </div>
      </RoleLayout>
    );
  }

  if (error && !request) {
    return (
      <RoleLayout role={role}>
        <div className="mx-auto max-w-xl py-24 text-center">
          <p className="font-grotesk text-xl font-black uppercase">{error}</p>
          <Button variant="outline" className="mt-4 rounded-xl" onClick={() => router.push(requestsHome)}>
            Back to My Requests
          </Button>
        </div>
      </RoleLayout>
    );
  }

  if (!request) return null;

  return (
    <RoleLayout role={role}>
      <div className="mx-auto max-w-4xl space-y-6 pb-16">
        {/* ============ HEADER ============ */}
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full text-[10px] font-black uppercase tracking-widest">
              {request.requestNumber || 'Request'}
            </Badge>
            <StatusBadge status={request.status} />
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Eye className="h-3 w-3" /> {request.views ?? 0} views
            </span>
          </div>
          <h1 className="font-grotesk text-2xl font-black uppercase tracking-tight md:text-3xl">
            {request.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span>{request.category}</span>
            {request.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {request.location}
              </span>
            )}
            {request.deadline && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Due {request.deadline}
              </span>
            )}
            <span>Qty {request.quantity ?? 1}</span>
            <span className="text-primary">{budgetLabel(request)}</span>
          </div>
        </header>

        {/* ============ BRIEF ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Customer need</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>
          </CardContent>
        </Card>

        {/* ============ ATTACHMENTS (§30) ============ */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <Paperclip className="h-4 w-4 text-primary" /> Attachments
            </CardTitle>
            {!mediaAuthorized && (
              <Badge variant="outline" className="gap-1 text-[10px] font-bold uppercase">
                <Lock className="h-3 w-3" /> Private
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {mediaAuthorized ? (
              media.length > 0 ? (
                <MediaViewerGrid media={media} />
              ) : (
                <p className="text-sm text-muted-foreground">No media was attached to this request.</p>
              )
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0" />
                Attachments are private. They are visible to businesses matched to this request.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============ CUSTOMER: OFFERS ============ */}
        {isOwner && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-grotesk text-xl font-black uppercase tracking-tight">
                Offers ({offers?.length ?? 0})
              </h2>
            </div>

            {offers?.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Matched businesses are reviewing your request. Offers will appear here.
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {(offers ?? []).map((offer) => (
                <Card key={offer.id} className={offer.status === 'accepted' ? 'border-green-500/50' : undefined}>
                  <CardContent className="space-y-4 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                          <Store className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-grotesk font-bold">{offer.sellerBusinessName || offer.sellerName || 'Business'}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {new Date(
                              typeof offer.createdAt === 'object' && offer.createdAt && 'toDate' in (offer.createdAt as object)
                                ? (offer.createdAt as { toDate: () => Date }).toDate()
                                : String(offer.createdAt ?? Date.now()),
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-grotesk text-xl font-black">
                          {offer.currency} {offer.price.toLocaleString()}
                        </p>
                        {offer.deliveryDays ? (
                          <p className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <Truck className="h-3 w-3" /> {offer.deliveryDays} days delivery
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{offer.message}</p>

                    {offer.media && offer.media.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Seller attachments
                        </p>
                        <MediaViewerGrid media={offer.media} layout="strip" />
                      </div>
                    )}

                    <Separator />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-black uppercase',
                          offer.status === 'accepted' && 'border-green-500/50 text-green-600',
                        )}
                      >
                        {offer.status === 'accepted' ? 'Deal agreed' : offer.status}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => messageSeller(offer.sellerId)}
                          className="rounded-xl font-bold uppercase tracking-wide"
                        >
                          <MessageSquareText className="mr-2 h-4 w-4" />
                          Message
                        </Button>
                        {request.status === 'active' && offer.status === 'submitted' && (
                          <Button
                            size="sm"
                            onClick={() => accept(offer.id)}
                            disabled={accepting !== null}
                            className="rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] font-black uppercase tracking-wide"
                          >
                            {accepting === offer.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Agree to this seller
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ============ SELLER: OFFER FORM (§31) ============ */}
        {isSellerView && request.status === 'active' && (
          <OfferFormCard
            key={myOffer?.id ?? 'new'}
            requestId={request.id ?? id}
            buyerId={request.customerId}
            buyerName={request.customerName}
            existingOffer={myOffer}
            onSubmitted={() => {
              setError(null);
              router.refresh();
            }}
          />
        )}
        {isSellerView && request.status !== 'active' && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              This request is no longer accepting offers.
            </CardContent>
          </Card>
        )}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </RoleLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Seller offer form (spec §31)                                        */
/* ------------------------------------------------------------------ */

function OfferFormCard({
  requestId,
  buyerId,
  buyerName,
  existingOffer,
  onSubmitted,
}: {
  requestId: string;
  buyerId: string;
  buyerName?: string;
  existingOffer?: OfferWithMedia | null;
  onSubmitted: () => void;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [price, setPrice] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [deliveryDays, setDeliveryDays] = React.useState('');
  const [images, setImages] = React.useState<AttachedMedia[]>([]);
  const [videos, setVideos] = React.useState<AttachedMedia[]>([]);
  const [draftId, setDraftId] = React.useState<string | null>(existingOffer?.id ?? null);
  const [existingStatus, setExistingStatus] = React.useState<string | null>(existingOffer?.status ?? null);
  const [starting, setStarting] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Hydrate the form from an existing offer (draft or submitted).
  React.useEffect(() => {
    if (!existingOffer) return;
    setPrice(String(existingOffer.price || ''));
    setMessage(existingOffer.message || '');
    setDeliveryDays(existingOffer.deliveryDays ? String(existingOffer.deliveryDays) : '');
    const attached = (existingOffer.media ?? []).map((m) => ({
      mediaId: m.mediaId,
      type: m.type as 'image' | 'video',
    }));
    setImages(attached.filter((m) => m.type === 'image'));
    setVideos(attached.filter((m) => m.type === 'video'));
  }, [existingOffer]);

  /**
   * "Start Your Offer" = TAKE the request: a draft is reserved instantly
   * (one per seller per request) so the seller is committed, the buyer
   * sees them as a participant, and messaging opens right away.
   */
  const startOffer = async () => {
    if (!user) return;
    setStarting(true);
    setError(null);
    try {
      const { createOfferDraft } = await import('@/lib/requests/client');
      const offer = await createOfferDraft(user, requestId);
      setDraftId(offer.id);
      setExistingStatus(offer.status);
      // The seller has taken the job — open the line to the buyer.
      if (firestore) await ensureChatWith(firestore, user.uid, buyerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the offer.');
    } finally {
      setStarting(false);
    }
  };

  const messageBuyer = async () => {
    if (!user || !firestore) return;
    try {
      await ensureChatWith(firestore, user.uid, buyerId);
      window.location.href = `/messages?chatWith=${buyerId}`;
    } catch {
      setError('Could not open the conversation. Try again.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !draftId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { submitOffer } = await import('@/lib/requests/client');
      await submitOffer(user, draftId, {
        price: Number(price),
        message: message.trim(),
        deliveryDays: deliveryDays ? Number(deliveryDays) : null,
        mediaIds: [...images, ...videos].map((m) => m.mediaId),
      });
      setExistingStatus('submitted');
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your offer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (existingStatus === 'submitted' && draftId) {
    return (
      <Card className="border-green-500/40 bg-green-500/[0.04]">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <p className="font-grotesk text-lg font-black uppercase">Offer sent</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Your offer is with the buyer. You can message them any time — you'll be notified
            here the moment they decide.
          </p>
          <Button variant="outline" onClick={messageBuyer} className="mt-1 rounded-xl font-bold uppercase tracking-wide">
            <MessageSquareText className="mr-2 h-4 w-4" />
            Message {buyerName || 'the buyer'}
          </Button>
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  if (!draftId) {
    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-grotesk text-lg font-black uppercase">Take this request</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Start your offer to claim the job — you'll get the offer form and a direct line to
            the buyer immediately. Then send your price, delivery time and examples when ready.
          </p>
          <Button
            onClick={startOffer}
            disabled={starting}
            className="mt-1 rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] font-black uppercase tracking-wide shadow-lg shadow-primary/25"
          >
            {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Start Your Offer
          </Button>
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-black uppercase tracking-widest">Your offer</CardTitle>
        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
          Price · details · media
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price (KES)</Label>
              <Input
                id="price"
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="35000"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery" className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" /> Delivery (days)
              </Label>
              <Input
                id="delivery"
                type="number"
                min={0}
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="e.g. 14"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Description</Label>
            <Textarea
              id="message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Custom 7-seater sofa in premium fabric. Includes delivery and installation…"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Media</Label>
            <MarketplaceMediaUploader
              user={user!}
              offerId={draftId}
              images={images}
              videos={videos}
              onChange={(next) => {
                setImages(next.images);
                setVideos(next.videos);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Show previous work, product examples or available designs — up to 5 photos and 2
              short videos (30s max).
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-[#FF4D2E] to-[#FF7A45] font-black uppercase tracking-wide shadow-lg shadow-primary/25"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Offer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={messageBuyer}
              className="rounded-xl font-bold uppercase tracking-wide"
            >
              <MessageSquareText className="mr-2 h-4 w-4" />
              Message {buyerName || 'the buyer'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
