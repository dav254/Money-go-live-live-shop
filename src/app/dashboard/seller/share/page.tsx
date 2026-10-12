'use client';

import * as React from 'react';
import {
  Copy,
  ExternalLink,
  Facebook,
  MessageCircle,
  QrCode,
  Share2,
  Twitter,
} from 'lucide-react';
import { SellerLayout } from '@/components/layout/seller-layout';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ShopQRDots } from '@/components/shop/ShopQRDots';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * SELLER WEBSITE · SHARE & QR (`/dashboard/seller/share`).
 *
 * The website half of the share section the app carries at
 * `/app/seller/share`. One QR (the real storefront URL encoded through
 * `qrcode`, drawn as rounded ember-eyed dots), one link, one download — the
 * two surfaces differ only in shell.
 *
 * Before this page existed there was no share destination in the seller
 * sidebar at all: the QR lived partway down a preview screen nobody linked
 * to, and a seller who wanted to hand a customer a code had to hunt for it.
 * This is the section the sidebar points at.
 */
export default function SellerSharePage() {
  const { user } = useUser();
  const { toast } = useToast();

  // Public storefront origin — resolved on the client so the share link and
  // the generated QR always encode the same URL the seller actually copies.
  const [origin, setOrigin] = React.useState('');
  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const sellerId = user?.uid ?? '';
  const shopLink = origin && sellerId ? `${origin}/sellers/${sellerId}` : '';

  const copyLink = async () => {
    if (!shopLink) return;
    try {
      await navigator.clipboard.writeText(shopLink);
      toast({ title: 'Link copied', description: 'Your public shop link is on your clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy the link' });
    }
  };

  const shareLink = async () => {
    if (!shopLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My shop', url: shopLink });
        return;
      } catch {
        return; // the seller dismissed the sheet — not an error
      }
    }
    await copyLink();
  };

  const encoded = encodeURIComponent(shopLink);
  const socials = [
    {
      label: 'WhatsApp',
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`Check out my shop: ${shopLink}`)}`,
    },
    {
      label: 'Facebook',
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    },
    {
      label: 'X',
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent('Check out my shop')}`,
    },
  ];

  return (
    <SellerLayout>
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">Share &amp; QR</h1>
            <p className="text-muted-foreground">
              Send buyers to your shop — one scan, one tap, one link.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 md:mt-0">
            <Button variant="outline" onClick={copyLink} disabled={!shopLink}>
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
            <Button onClick={shareLink} disabled={!shopLink}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── The QR — real code, unique look, download on demand ───── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                Your shop QR code
              </CardTitle>
              <CardDescription>
                Download the image and print it for your counter, packaging or
                market stall — scanning it opens your storefront.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ShopQRDots
                shopId={sellerId || 'shop'}
                shopUrl={shopLink}
                accentColor="#FF4D2E"
                size={320}
                pitchLine="Scan to reach your shop"
                showDownload
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {/* ── The link + where to post it ─────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your shop link</CardTitle>
                <CardDescription>
                  {shopLink || 'Resolving your shop link…'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={copyLink} disabled={!shopLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy link
                  </Button>
                  <Button asChild variant="outline">
                    <a href={shopLink || undefined} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open shop
                    </a>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {socials.map((s) => (
                    <Button
                      key={s.label}
                      asChild
                      variant="outline"
                      size="sm"
                    >
                      <a href={shopLink ? s.href : undefined} target="_blank" rel="noreferrer">
                        <s.icon className="mr-2 h-3.5 w-3.5" />
                        {s.label}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── What the code is for ────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Where it works best</CardTitle>
                <CardDescription>
                  The code is generated from your live storefront URL, so it
                  always opens the shop as it looks right now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  <li>Print it small — it stays scannable from a sticker or a receipt.</li>
                  <li>Post the PNG to WhatsApp status or your stories.</li>
                  <li>Put it on packaging so repeat buyers land in one scan.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
