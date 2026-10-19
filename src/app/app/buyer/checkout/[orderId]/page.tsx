'use client';

/**
 * BUYER APP · CHECKOUT (`/app/buyer/checkout/[orderId]`).
 *
 * ## Why this exists
 *
 * "Pay now" in My orders pointed at `/checkout/{orderId}` — the website's
 * checkout. So paying an invoice threw the buyer out of the app into a screen
 * with the website's chrome, and the app had no way to show a buyer anything
 * about the payment afterwards. This is that screen, natively.
 *
 * ## Cards are a first-class option, not a fallback
 *
 * The old screen derived its entire copy from an IP geolocation guess:
 * a Kenyan visitor saw a button reading "Pay with M-Pesa" and nothing else,
 * which is why the Paystack page in the screenshot offered mobile money only.
 * That is a bad default in both directions — a Kenyan buyer may well have a
 * debit card, and a card is what most non-cash payments on this platform
 * actually are.
 *
 * So the buyer picks the method here, and this screen offers **all four**
 * Paystack channels plus PayPal:
 *
 *   M-PESA · Card (credit/debit) · Bank transfer · PayPal
 *
 * Which of them Paystack will actually honour is decided by the merchant
 * account's own dashboard settings, not by this screen. The channel list sent
 * to Paystack is `card, mobile_money, bank, ussd` — see
 * `api/create-payment-intent` — and Paystack intersects that with what the
 * account has enabled. If cards are missing at the real Paystack page, the fix
 * is enabling Cards in the Paystack dashboard, not editing this file.
 *
 * ## What it deliberately does NOT do
 *
 * It does not collect card numbers. Card details are typed into Paystack's own
 * hosted page over TLS; they never touch Vidnov's servers, which is the only
 * way to avoid handling PAN data and the PCI obligations that come with it.
 * This screen's job is to choose a channel and start the redirect.
 */

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, CreditCard, Loader2, Lock,
  MessageCircle, Package, ShieldCheck, Smartphone, Truck,
} from 'lucide-react';

import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Order, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { BuyerCard, BuyerStatusPill } from '@/components/app/buyer/buyer-app-shell';
import { cn } from '@/lib/utils';

type PaystackChannel = 'mobile_money' | 'card' | 'bank' | 'ussd';
type Method = PaystackChannel | 'paypal';

/**
 * The options, in the order they are offered.
 *
 * Mobile money first because it is the dominant method in the market this
 * serves, but every other option sits right beside it — a buyer with a debit
 * card should never have to hunt for it or wonder whether it exists.
 */
const METHODS: {
  id: Method;
  label: string;
  detail: string;
  icon: React.ElementType;
  tone: string;
}[] = [
  {
    id: 'mobile_money',
    label: 'M-PESA',
    detail: 'Prompt on your phone. Confirm with your PIN.',
    icon: Smartphone,
    tone: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'card',
    label: 'Credit or debit card',
    detail: 'Visa, Mastercard, Verve. Saved securely by Paystack.',
    icon: CreditCard,
    tone: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'bank',
    label: 'Bank transfer',
    detail: 'Pay from your bank account. No card needed.',
    icon: Building2,
    tone: 'from-violet-500 to-purple-600',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    detail: 'Pay from your PayPal balance or a linked card.',
    icon: WalletIcon,
    tone: 'from-sky-500 to-cyan-600',
  },
];

export default function BuyerCheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params?.orderId === 'string' ? params.orderId : '';
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [order, setOrder] = React.useState<Order | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [paying, setPaying] = React.useState<Method | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);

  /*
   * Which gateways the server can actually start. `null` until the probe
   * answers — and if it never answers the list stays complete (fail open),
   * because hiding every button over a flaky probe would be worse than a
   * server-side error toast.
   */
  const [gateways, setGateways] = React.useState<{
    paystack?: boolean;
    paypal?: boolean;
  } | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/create-payment-intent')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && typeof data === 'object') setGateways(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!firestore || !orderId) return;
    let alive = true;
    const unsub = onSnapshot(
      doc(firestore, 'orders', orderId),
      (snap) => {
        if (!alive) return;
        setOrder(snap.exists() ? ({ ...(snap.data() as Order), id: snap.id } as Order) : null);
        setIsLoading(false);
      },
      () => setIsLoading(false),
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [firestore, orderId]);

  /*
   * The product this order is for.
   *
   * Orders snapshot the product's name and image at checkout, but the snapshot
   * is not trustworthy: it was written as `product.name || 'Unnamed Product'`
   * and `product.imageUrl || getPlaceholderImage()`, so an order created from a
   * product with no `name` yet carries the literal string "Unnamed Product"
   * and a flat dark placeholder. The screenshot showed exactly that.
   *
   * So we re-read the live product document and prefer it over the snapshot
   * for anything the snapshot is missing. Products are publicly readable, so
   * a single getDoc on the product id is allowed by the Firestore rules.
   */
  const orderProductId = React.useMemo(() => {
    if (!order) return null;
    const first = Array.isArray(order.items) && order.items.length ? order.items[0] : null;
    const id = order.productId || first?.productId;
    return typeof id === 'string' && id ? id : null;
  }, [order]);

  React.useEffect(() => {
    if (!firestore || !orderProductId) {
      setProduct(null);
      return;
    }
    let alive = true;
    getDoc(doc(firestore, 'products', orderProductId))
      .then((snap) => {
        if (!alive) return;
        setProduct(snap.exists() ? ({ ...(snap.data() as Product), id: snap.id } as Product) : null);
      })
      .catch(() => {
        if (alive) setProduct(null);
      });
    return () => {
      alive = false;
    };
  }, [firestore, orderProductId]);

  /**
   * Starts the payment.
   *
   * The channel is chosen here and forwarded as `channel`, so a buyer who
   * picked "bank transfer" arrives at Paystack already on that method rather
   * than being offered a list again. Paystack decides what it will actually
   * accept — this screen cannot promise a channel the merchant account has
   * disabled.
   */
  const pay = async (method: Method) => {
    if (!order) return;
    if (!user?.email) {
      toast({
        variant: 'destructive',
        title: 'Add an email to your account',
        description: 'Payment receipts are sent by email — add one in Profile, then try again.',
      });
      return;
    }
    // Older order documents carry `productPrice` but no `totalAmount`;
    // sending 0 made the server reject the payment with "Missing required
    // payment details." — which read to the buyer as "payment refused".
    // Fall through the same fields the summary itself renders.
    const amount =
      Number(order.totalAmount) || Number(order.productPrice) || Number(order.subtotal) || 0;
    if (amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'This order has no payable amount',
        description: 'The total is missing on this order. Message the seller, or reopen checkout in a minute.',
      });
      return;
    }
    setPaying(method);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          amount,
          email: user.email,
          gateway: method === 'paypal' ? 'paypal' : 'paystack',
          channel: method === 'paypal' ? undefined : method,
          transactionType: 'product-purchase',
          // Where the gateway should send the buyer back to. Without this,
          // Paystack falls back to the dashboard's default URL and the buyer
          // who just paid lands on the marketing site believing nothing
          // happened. The server validates this is a same-site path.
          returnTo: `/app/buyer/checkout/${order.id}`,
        }),
      });
      const data = (await res.json()) as {
        checkoutUrl?: string;
        error?: string;
        fallbackNotice?: string;
      };

      if (!res.ok || !data.checkoutUrl) {
        toast({
          variant: 'destructive',
          title: 'Could not start the payment',
          description: data.error || 'Please try again.',
        });
        // CRITICAL: reset the busy state here. It used to stay set on every
        // failed attempt, which left ALL payment buttons disabled after a
        // single error — the buyer's taps did nothing from then on, which is
        // exactly what "the Pay Now button is not working" looked like.
        setPaying(null);
        return;
      }

      // The method they picked was not available on the merchant account, so
      // the server widened the channel list. Say so before Paystack opens
      // with a different method than the one they tapped.
      if (data.fallbackNotice) {
        toast({
          title: 'That method is not available yet',
          description: data.fallbackNotice,
          duration: 7000,
        });
      }

      // Full page redirect: the payment happens on Paystack's own domain, in
      // the browser tab Paystack returns to. Never an iframe or a popup —
      // card entry in a frame is blocked and looks like a phishing attempt.
      window.location.href = data.checkoutUrl;
      // If the browser refuses the navigation (rare, some webviews), the
      // buttons must come back instead of staying disabled forever.
      setPaying(null);
    } catch {
      toast({ variant: 'destructive', title: 'Could not reach the payment server.' });
      setPaying(null);
    }
  };

  /*
   * Restoring from the back/forward cache can resurrect the exact JS state
   * from before the redirect — including the busy flag that disables every
   * payment button. Clear it whenever the page is restored, so a buyer who
   * backs out of Paystack can simply try again.
   */
  React.useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPaying(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  /*
   * Paystack returns the buyer here with ?reference= / ?trxref= once they
   * finish (callback_url on the intent). The order document flips to PAID
   * via the Paystack webhook — this strip just tells the buyer the wait is
   * the confirmation step working, not a broken button.
   */
  const [returnedFromGateway, setReturnedFromGateway] = React.useState(false);
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reference') || params.get('trxref')) setReturnedFromGateway(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 pt-6">
        <BuyerCard>
          <p className="text-base font-semibold text-foreground">Order not found</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This order may have been removed, or it belongs to another account.
          </p>
          <Button
            onClick={() => router.push('/app/buyer/orders')}
            className="mt-4 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 text-white"
          >
            Back to my orders
          </Button>
        </BuyerCard>
      </div>
    );
  }

  const total = Number(order.totalAmount) || 0;
  const shipping = Number(order.shippingCost) || 0;
  const subtotal = total - shipping;

  /*
   * Methods to offer. Once the probe answers, a gateway the server is not
   * configured for is simply not rendered — e.g. PayPal with no
   * PAYPAL_CLIENT_ID/SECRET was a button guaranteed to fail with
   * "PayPal is not configured on this server." The option comes back by
   * itself the moment the keys land in the server's .env.
   */
  const visibleMethods = METHODS.filter((m) => {
    if (!gateways) return true;
    return m.id === 'paypal' ? gateways.paypal === true : gateways.paystack === true;
  });
  const wasCredited = Number(order.deliveryCreditApplied) === 1;

  /*
   * What the summary renders.
   *
   * Older orders carry no `items` array at all, only the flat productId /
   * productName / productImage fields, so we synthesise the single line from
   * those. A placeholder written at checkout (`placehold.co`) is treated as
   * "no image" rather than as a real picture, and a video product falls back
   * to its poster frame so the buyer sees the thing they are buying.
   */
  const lines = React.useMemo(() => {
    type Row = {
      productId: string;
      name: string;
      price: number;
      quantity: number;
      imageUrl?: string;
    };

    const stored = Array.isArray(order.items) ? (order.items as Row[]) : [];
    const rows: Row[] = stored.length
      ? stored
      : [
          {
            productId: order.productId || '',
            name: order.productName || '',
            price: Number(order.productPrice) || Number(order.subtotal) || 0,
            quantity: Number(order.quantity) || 1,
            imageUrl: order.productImage || '',
          },
        ];

    // A `placehold.co` URL was baked in at checkout time when the product had
    // no image yet, so it means "missing", not "this is the picture".
    const usable = (url?: string) => Boolean(url) && !/placehold\.co/i.test(url || '');

    return rows.map((row, i) => {
      const matches = !row.productId || row.productId === product?.id;
      const livePoster = matches
        ? product?.videoThumbnailUrls?.[0] ||
          (product?.hasVideo || product?.videoUrl ? product.imageUrl : undefined)
        : undefined;
      const name =
        row.name && row.name !== 'Unnamed Product' ? row.name : matches ? product?.name || '' : '';

      let imageUrl = '';
      if (usable(row.imageUrl)) imageUrl = row.imageUrl as string;
      else if (usable(livePoster)) imageUrl = livePoster as string;
      else if (matches && usable(product?.imageUrl)) imageUrl = product?.imageUrl as string;
      else if (matches && usable(product?.thumbnailUrls?.[0])) imageUrl = product?.thumbnailUrls?.[0] as string;

      return {
        key: `${row.productId || 'order'}-${i}`,
        name,
        quantity: row.quantity ?? 1,
        price: Number(row.price) || 0,
        imageUrl,
        isVideo: !usable(row.imageUrl) && Boolean(livePoster),
      };
    });
  }, [order, product]);

  return (
    <div className="vn-page-enter pb-8">
      {/* --------------------------------------------------------- header */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-1">
        <button
          type="button"
          onClick={() => router.push('/app/buyer/orders')}
          aria-label="Back to my orders"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Checkout</h1>
          <p className="text-[11px] text-muted-foreground">
            Order #{order.id?.slice(-6).toUpperCase()}
          </p>
        </div>
        <div className="ml-auto">
          <BuyerStatusPill status={order.orderStatus || 'pending'} />
        </div>
      </div>

      {/* ------------------------------------------------------- summary */}
      <div className="px-4">
        <BuyerCard>
          <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
            Order summary
          </p>

          <ul className="mt-3 space-y-3">
            {lines.map((item) => (
              <li key={item.key} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name || 'Product'}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {item.isVideo && (
                    <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                      Video
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.name || 'Product'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Qty {item.quantity ?? 1}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">
                  ${(Number(item.price) || 0).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-border pt-3">
            <Row label="Subtotal" value={`$${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
            <Row
              label="Delivery"
              value={
                wasCredited ? 'Free — referral credit' :
                shipping > 0 ? `$${shipping.toFixed(2)}` : 'Free'
              }
              highlight={wasCredited || shipping === 0}
            />
            <div className="flex items-baseline justify-between pt-2">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-2xl font-black tracking-tight text-foreground">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </BuyerCard>
      </div>

      {/* ------------------------------------------ returned from gateway */}
      {returnedFromGateway && (
        <div className="mb-3 px-4">
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-600 dark:text-emerald-400">
            Payment received — confirming with your bank now. This order flips to
            <span className="font-bold"> PAID </span>
            automatically; you can close this screen.
          </p>
        </div>
      )}

      {/* ------------------------------------------------------- methods */}
      <div className="mt-4 px-4">
        <p className="vn-micro mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-500 dark:text-cyan-400">
          Secure payment options
        </p>

        {!user?.email && (
          <p className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
            Add an email address to your account before paying — receipts are sent by email.
          </p>
        )}

        {gateways && visibleMethods.length === 0 && (
          <p className="rounded-xl border border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
            Online payments are being configured right now — check back in a few minutes.
          </p>
        )}

        <div className="space-y-2">
          {visibleMethods.map((m) => {
            const Icon = m.icon;
            const busy = paying === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!!paying}
                onClick={() => pay(m.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition',
                  'hover:border-cyan-400/50 active:scale-[0.99] disabled:opacity-60',
                )}
              >
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
                    m.tone,
                  )}
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{m.label}</span>
                  <span className="block text-[11px] leading-relaxed text-muted-foreground">
                    {m.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------- trust */}
      <div className="mt-4 px-4">
        <BuyerCard>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Card details are entered on Paystack&apos;s secure page, never on ours. Funds are held
              until delivery is confirmed.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-[11px] text-muted-foreground">TLS encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] text-muted-foreground">Escrow protected</span>
            </div>
          </div>
        </BuyerCard>
      </div>

      {/* ------------------------------------------------------- contact */}
      {order.sellerId && (
        <div className="mt-4 px-4">
          <Button
            asChild
            variant="ghost"
            className="w-full rounded-2xl text-sm text-muted-foreground"
          >
            <a
              href={`/app/buyer/messages?chatWith=${encodeURIComponent(order.sellerId)}`}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Message the seller
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-medium tabular-nums',
          highlight ? 'text-emerald-500' : 'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Inline PayPal mark — a glyph rather than another network round trip. */
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="17" cy="14" r="1.6" fill="white" />
    </svg>
  );
}
