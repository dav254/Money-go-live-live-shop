'use client';

import type { Seller } from '@/lib/types';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Bookmark,
  Headphones,
  Heart,
  MapPin,
  MessageSquare,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Users,
  Verified,
  Zap,
} from 'lucide-react';
import { mergeSocialLinks, socialPlatformFor } from '@/lib/social-links';
import { SOCIAL_LINK_ICONS } from '@/components/seller/social-link-icons';
import { useUser, useFirestore, useUserProfile } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SellerHeaderProps {
  seller: Seller;
  /**
   * The seller's REAL product categories, derived on the page from the
   * products actually loaded for this shop. Never hardcoded — an empty list
   * simply hides the category line.
   */
  categories?: string[];
}

/**
 * Every link this shop publishes, in one list.
 *
 * The seller fills in a free-form `socialLinks` list in the app; the three
 * legacy Facebook/Instagram/Twitter columns are folded in by `mergeSocialLinks`
 * so a shop set up before free-form links existed keeps its icons. Icons come
 * from the hostname, and an unknown one gets a globe rather than being hidden.
 */
function shopLinks(seller: Seller) {
  return mergeSocialLinks({
    socialLinks: seller.socialLinks,
    facebookUrl: seller.facebookUrl,
    instagramUrl: seller.instagramUrl,
    twitterUrl: seller.twitterUrl,
    contactWhatsapp: seller.contactWhatsapp,
  }).map((link) => ({ ...link, icon: SOCIAL_LINK_ICONS[socialPlatformFor(link.url).id] }));
}

/**
 * The real shop actions — follow, message, share — lifted out of the header
 * markup so the header and the bottom action bar share ONE implementation
 * instead of growing two copies that can drift apart.
 */
export function useShopActions(seller: Seller) {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (userProfile && userProfile.following && seller.id) {
      setIsFollowing(userProfile.following.includes(seller.id));
    }
  }, [userProfile, seller.id]);

  const handleFollow = async () => {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Please log in to follow sellers.' });
      return;
    }

    const newFollowingState = !isFollowing;
    setIsFollowing(newFollowingState);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/follow', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sellerId: seller.id,
          action: newFollowingState ? 'follow' : 'unfollow',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status.');
      }

      toast({
        title: newFollowingState ? 'Followed!' : 'Unfollowed',
        description: `You are now ${newFollowingState ? 'following' : 'no longer following'} ${seller.name}.`,
      });
    } catch (error) {
      console.error('Error updating follow status:', error);
      setIsFollowing(!newFollowingState);
      toast({ variant: 'destructive', title: 'Something went wrong' });
    }
  };

  const handleMessageSeller = async () => {
    if (!user || !firestore) {
      toast({ title: 'Please log in', description: 'You need to be logged in to send a message.' });
      router.push('/login');
      return;
    }
    if (seller.id === user.uid) {
      toast({ title: 'Cannot start chat', description: 'You cannot message yourself.' });
      return;
    }

    const chatsRef = collection(firestore, 'chats');
    const q = query(chatsRef, where('participantIds', 'array-contains', user.uid));

    try {
      const querySnapshot = await getDocs(q);
      let existingChatId: string | null = null;
      querySnapshot.forEach((d) => {
        // Same guard as the live and request flows: a chat document is not
        // guaranteed to carry `participantIds`, and reading it unguarded throws
        // on any legacy record that omits it.
        const ids: string[] = d.data().participantIds ?? [];
        if (ids.includes(seller.id)) {
          existingChatId = d.id;
        }
      });

      const newChatRef = existingChatId ? doc(firestore, 'chats', existingChatId) : doc(collection(firestore, 'chats'));
      if (!existingChatId) {
        await setDoc(newChatRef, {
          id: newChatRef.id,
          participantIds: [user.uid, seller.id],
          lastMessage: 'Conversation started.',
          lastMessageTimestamp: serverTimestamp(),
        });
      }
      router.push(`/messages?chatWith=${seller.id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not start chat.' });
    }
  };

  const handleShare = () => {
    const shopUrl = `https://goearnvid.shop/sellers/${seller.id}`;
    navigator.clipboard
      .writeText(shopUrl)
      .then(() => {
        toast({
          title: 'Link Copied!',
          description: 'The shop link has been copied to your clipboard.',
        });
      })
      .catch((err) => {
        console.error('Failed to copy shop link: ', err);
        toast({
          variant: 'destructive',
          title: 'Failed to Copy',
          description: 'Could not copy the shop link.',
        });
      });
  };

  /** Jump to the product grid without inventing navigation that does not exist. */
  const scrollToProducts = () => {
    const el = document.getElementById('shop-products');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return { user, isFollowing, handleFollow, handleMessageSeller, handleShare, scrollToProducts };
}

/* ------------------------------------------------------------------ */
/* Trust strip — only claims backed by real data                      */
/* ------------------------------------------------------------------ */

function TrustStrip({ seller }: { seller: Seller }) {
  const POPULAR_FOLLOWERS = 10000;
  const NEW_SELLER_DAYS = 30;

  const items = useMemo(() => {
    const joined = seller.joinedDate ? new Date(seller.joinedDate) : null;
    const isNew =
      !!joined && (Date.now() - joined.getTime()) / (1000 * 3600 * 24) < NEW_SELLER_DAYS;
    const hasReviews = (seller.reviewsCount ?? 0) > 0 && (seller.rating ?? 0) > 0;

    const list = [
      seller.deliversFast && {
        key: 'delivery',
        icon: Truck,
        tone: 'text-emerald-400',
        title: 'Fast delivery',
        sub: 'Per shop policy',
      },
      {
        key: 'payment',
        icon: ShieldCheck,
        tone: 'text-emerald-400',
        title: 'Secure payment',
        sub: 'Vidnov checkout',
      },
      hasReviews && {
        key: 'rated',
        icon: Star,
        tone: 'text-amber-400',
        title: `${(seller.rating ?? 0).toFixed(1)}★ rated`,
        sub: `${seller.reviewsCount} review${seller.reviewsCount === 1 ? '' : 's'}`,
      },
      (seller.followers ?? 0) >= POPULAR_FOLLOWERS && {
        key: 'popular',
        icon: Users,
        tone: 'text-[#FF2D55]',
        title: 'Popular shop',
        sub: `${(seller.followers || 0).toLocaleString()} followers`,
      },
      isNew && {
        key: 'new',
        icon: Zap,
        tone: 'text-sky-400',
        title: 'New seller',
        sub: 'Recently joined',
      },
      {
        key: 'support',
        icon: Headphones,
        tone: 'text-[#FF2D55]',
        title: 'Seller support',
        sub: 'Message the shop',
      },
    ].filter(Boolean) as Array<{
      key: string;
      icon: typeof Truck;
      tone: string;
      title: string;
      sub: string;
    }>;

    return list;
  }, [seller]);

  return (
    <div
      className="mt-5 flex gap-2 overflow-x-auto pb-1"
      aria-label="Shop trust and service indicators"
    >
      {items.map(({ key, icon: Icon, tone, title, sub }) => (
        <div
          key={key}
          className="flex min-w-[9.5rem] shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
        >
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/40', tone)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-white">{title}</span>
            <span className="block truncate text-[10px] text-neutral-400">{sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header: banner + identity + trust + links                          */
/* ------------------------------------------------------------------ */

export function SellerHeader({ seller, categories = [] }: SellerHeaderProps) {
  const { isFollowing, handleFollow } = useShopActions(seller);
  const links = shopLinks(seller);

  return (
    <div className="bg-[#060C18]">
      {/* Cinematic banner — the seller's real image, rounded and blended into the page */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="relative h-52 w-full overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_-18px_rgba(255,0,51,0.55)] md:h-80">
          <Image
            src={seller.banner.imageUrl}
            alt={`${seller.name}'s banner`}
            fill
            sizes="100vw"
            className="object-cover"
            priority
            data-ai-hint={seller.banner.imageHint}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060C18] via-[#060C18]/35 to-transparent" />
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Identity */}
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
            <Avatar className="h-24 w-24 shrink-0 rounded-full border border-black/50 ring-4 ring-[#FF0033] shadow-[0_0_28px_rgba(255,0,51,0.55)]">
              <AvatarImage src={seller.avatar.imageUrl} alt={`${seller?.name || 'Seller'} logo`} />
              <AvatarFallback className="rounded-full bg-neutral-900 text-2xl font-black text-white">
                {seller.name.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="max-w-full truncate text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
                  {seller.name}
                </h1>
                {seller.isVerified && (
                  <Verified className="h-5 w-5 shrink-0 fill-current text-blue-400" aria-label="Verified seller" />
                )}
              </div>

              {seller.description && seller.description !== 'No description available.' && (
                <p className="line-clamp-2 text-sm text-neutral-300">{seller.description}</p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-400 sm:justify-start">
                {seller.location && seller.location !== 'Not specified' && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-[#FF2D55]" aria-hidden />
                    {seller.location}
                  </span>
                )}
                {/* Only shown when real live-session data says so — never a fake "online now". */}
                {seller.isLive && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                    Live now
                  </span>
                )}
                {categories.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    {categories.join(' | ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Follow + follower count, as in the reference */}
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <Button
              onClick={handleFollow}
              variant="outline"
              aria-pressed={isFollowing}
              className={cn(
                'h-10 rounded-full border border-[#FF0033] bg-transparent px-6 text-sm font-bold text-white hover:bg-[#FF0033]/15 hover:text-white',
                isFollowing && 'bg-[#FF0033] hover:bg-[#e6002d]',
              )}
            >
              <Heart className={cn('mr-2 h-4 w-4', isFollowing && 'fill-current')} aria-hidden />
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            <span className="text-[11px] font-bold text-neutral-400">
              {(seller.followers || 0).toLocaleString()} followers
            </span>
          </div>
        </div>

        {/* Trust / service benefits — every tile backed by real data */}
        <TrustStrip seller={seller} />

        {/* The shop's real published links */}
        {links.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            {links.map(({ id, url, label, icon: Icon }) => (
              <a
                key={id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                aria-label={label}
                className={cn(
                  'rounded-lg border border-white/10 bg-white/5 p-2 text-white transition-all',
                  socialPlatformFor(url).hover,
                )}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        )}


      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom action bar: Shop · Chat Seller · Share Shop · Save Shop     */
/* ------------------------------------------------------------------ */

export function ShopBottomActions({ seller }: { seller: Seller }) {
  const { isFollowing, handleFollow, handleMessageSeller, handleShare, scrollToProducts } =
    useShopActions(seller);

  const items = [
    {
      key: 'shop',
      label: 'Shop',
      icon: ShoppingCart,
      onClick: scrollToProducts,
      active: false,
      disabled: false,
    },
    {
      key: 'chat',
      label: 'Chat Seller',
      icon: MessageSquare,
      onClick: handleMessageSeller,
      active: false,
      disabled: false,
    },
    {
      key: 'share',
      label: 'Share Shop',
      icon: Share2,
      onClick: handleShare,
      active: false,
      disabled: false,
    },
    {
      // Saving a shop IS following it — the app has no separate "saved shops"
      // collection, so this reuses the real follow feature rather than
      // inventing a fake one.
      key: 'save',
      label: isFollowing ? 'Saved' : 'Save Shop',
      icon: Bookmark,
      onClick: handleFollow,
      active: isFollowing,
      disabled: false,
    },
  ];

  return (
    <div className="mx-auto mt-10 max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-4 gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2 sm:gap-3 sm:p-3">
        {items.map(({ key, label, icon: Icon, onClick, active }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-3 transition-colors',
              active ? 'bg-[#FF0033] text-white' : 'text-neutral-300 hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="w-full truncate text-center text-[10px] font-bold uppercase tracking-wider">
              {label}
            </span>
          </button>
        ))}
      </div>
      {isFollowing && (
        <p className="mt-2 text-center text-[11px] text-neutral-500">
          This shop is saved in the list you follow
        </p>
      )}
    </div>
  );
}
