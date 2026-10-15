'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  collection, deleteDoc, doc, increment, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import {
  errorEmitter, useCollection, useFirestore, useUser, useUserProfile,
} from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import type { CartItem, Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  BuyerCard, BuyerEmptyState, BuyerSectionTitle,
} from '@/components/app/buyer/buyer-app-shell';

/**
 * BUYER APP · CART.
 *
 * Clone of the website's `/cart`: the same `userProfiles/{uid}/cart`
 * subcollection, the same quantity and remove writes, the same simplified
 * shipping rule and the same order-creation path into the APP's checkout at
 * `/app/buyer/checkout/{id}`.
 * Only the presentation differs — stacked cards, summary sheet and a pill CTA
 * sized for a thumb instead of a three-column desktop layout.
 */

const PLACEHOLDER_IMAGE = '/placeholder-image.svg';

export default function BuyerSectionCart() {
  const { user } = useUser();
  const { userProfile, isLoading: isProfileLoading } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);

  const cartQuery = React.useMemo(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'userProfiles', user.uid, 'cart');
  }, [user, firestore]);

  const { data: cartItems, isLoading: areItemsLoading } = useCollection<CartItem>(cartQuery);
  const isLoading = areItemsLoading || isProfileLoading;

  const subtotal = React.useMemo(
    () => cartItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0,
    [cartItems],
  );

  /*
   * Shipping, with the referral credit applied automatically.
   *
   * The flat $5 rule is unchanged. What is new is that a buyer holding at least
   * one `deliveryCredits` — earned by referring people, or granted by an admin —
   * ships free, with no toggle to find and no checkout step. It is "automatic
   * when the balance is high enough", which is the whole point: a credit the
   * buyer has to remember to spend is a credit they will not spend.
   *
   * The credit is spent only when an order is actually created (see
   * `handleCheckout`), so browsing or abandoning a cart never burns one. That
   * decrement is deliberately separate from the quote below — showing "free
   * delivery" and then charging for it if the write failed would be worse than
   * not offering it.
   */
  const availableCredits = Number(userProfile?.deliveryCredits) || 0;
  const baseShipping = subtotal > 0 ? 5 : 0;
  const shippingCost = availableCredits > 0 ? 0 : baseShipping;
  const total = subtotal + shippingCost;

  const handleQuantityChange = async (item: CartItem, newQuantity: number) => {
    if (!user || !firestore || newQuantity < 1) return;
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid, 'cart', item.productId), {
        quantity: newQuantity,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update item quantity.' });
    }
  };

  const handleRemoveItem = async (item: CartItem) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'userProfiles', user.uid, 'cart', item.productId));
      toast({ title: 'Item removed', description: `${item.name} is no longer in your cart.` });
    } catch {
      toast({ variant: 'destructive', title: 'Could not remove that item.' });
    }
  };

  const handleCheckout = async () => {
    if (!user || !firestore || !cartItems || cartItems.length === 0 || !userProfile) {
      toast({ variant: 'destructive', title: 'Your cart is empty.' });
      return;
    }

    setIsCheckingOut(true);

    // Assume all items are from the same seller — identical to the website.
    const sellerId = cartItems[0].sellerId;

    let resellerId = localStorage.getItem('resellerRefId');
    if (!resellerId && (userProfile as { referredBy?: string }).referredBy) {
      resellerId = (userProfile as { referredBy?: string }).referredBy ?? null;
    }

    const newOrderRef = doc(collection(firestore, 'orders'));
    const newOrderData: Partial<Order> = {
      id: newOrderRef.id,
      buyerId: user.uid,
      sellerId,
      items: cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      })),
      subtotal,
      productPrice: subtotal,        shippingCost,
        // Recorded on the order so support can see the delivery was credited
        // rather than simply free, and so the credit is auditable after the
        // fact instead of inferred from a zero.
        deliveryCreditApplied: availableCredits > 0 && baseShipping > 0 ? 1 : 0,
      totalAmount: total,
      orderDate: serverTimestamp() as never,
      shippingAddress: '123 Placeholder Lane, Nairobi',
      orderStatus: 'pending',
      paymentMethod: 'pending',
      ...(resellerId ? { resellerId } : {}),
    };

    try {
      await setDoc(newOrderRef, newOrderData);

      // Spend the delivery credit, but only after the order exists. Decrementing
      // first would burn the credit on an order that then failed to write;
      // not decrementing at all would make one credit cover every order forever.
      if (availableCredits > 0 && baseShipping > 0) {
        await updateDoc(doc(firestore, 'userProfiles', user.uid), {
          deliveryCredits: increment(-1),
        }).catch(() => undefined);
      }

      if (resellerId) localStorage.removeItem('resellerRefId');
      toast({ title: 'Order created!', description: 'Redirecting to checkout…' });
      router.push(`/app/buyer/checkout/${newOrderRef.id}`);
    } catch (error) {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: newOrderRef.path,
          operation: 'create',
          requestResourceData: newOrderData,
        }),
      );
    } finally {
      setIsCheckingOut(false);
    }
  };

  const isEmpty = !isLoading && (!cartItems || cartItems.length === 0);

  return (
    <div className="vn-page-enter space-y-5 pb-2">
      <BuyerSectionTitle
        eyebrow="Basket"
        title="Your cart"
        action={
          <span className="vn-micro rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
            {cartItems?.length ?? 0} item{(cartItems?.length ?? 0) === 1 ? '' : 's'}
          </span>
        }
      />

      {isLoading ? (
        <div className="space-y-3 px-4">
          {[0, 1].map((i) => (
            <div key={i} className="vn-skeleton h-24 w-full rounded-3xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <BuyerEmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          body="Browse the marketplace and add something you love — items stay here until you check out."
          action={
            <Link
              href="/app/buyer/shop"
              className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2.5 font-sans text-xs font-semibold text-white"
            >
              Start shopping
            </Link>
          }
        />
      ) : (
        <>
          {/* Items */}
          <div className="space-y-3 px-4">
            {(cartItems ?? []).map((item) => (
              <BuyerCard key={item.id} className="flex items-start gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                  <Image
                    src={item.imageUrl || PLACEHOLDER_IMAGE}
                    fill
                    alt={item.name}
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums text-cyan-600 dark:text-cyan-300">
                    ${item.price.toLocaleString()}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={item.quantity <= 1}
                      onClick={() => handleQuantityChange(item, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-border transition enabled:hover:ring-cyan-400 disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="vn-micro w-6 text-center text-sm font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => handleQuantityChange(item, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-border transition hover:ring-cyan-400"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => handleRemoveItem(item)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </BuyerCard>
            ))}
          </div>

          {/* Summary */}
          <div className="px-4">
            <BuyerCard className="bg-gradient-to-br from-cyan-500/12 to-violet-500/12 ring-1 ring-cyan-400/25">
              <p className="vn-micro text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                Order summary
              </p>

              <dl className="mt-3 space-y-2 font-sans text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <dt>Subtotal</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Shipping</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    ${shippingCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-border/70 pt-2.5">
                  <dt className="text-base font-semibold text-foreground">Total</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </dd>
                </div>
              </dl>

              <Button
                onClick={handleCheckout}
                disabled={isCheckingOut || isEmpty}
                className="mt-4 h-12 w-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 font-sans text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:opacity-95"
              >
                {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Proceed to checkout
              </Button>

              <p className="mt-3 font-sans text-[11px] leading-relaxed text-muted-foreground">
                Payment, VAT and the seller&apos;s split are calculated at checkout — the same
                totals the website shows.
              </p>
            </BuyerCard>
          </div>
        </>
      )}
    </div>
  );
}
