'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * BUY AI POINTS — one implementation for every surface that sells a top-up.
 *
 * Extracted from `/dashboard/seller/ai-tools` so the AI Points sections (both
 * the website page and the app's `/app/seller/points`) can offer the same
 * packages and the same Paystack/PayPal hand-off without a second copy of the
 * payment call drifting away from the first.
 *
 * `BuyPointsDialog` renders only the `DialogContent` (it belongs inside a
 * `<Dialog>`); `BuyPointsButton` is the complete control — trigger plus
 * content — for pages that just want "Top up".
 *
 * The intent POSTs to `/api/create-payment-intent` with
 * `transactionType: 'points-purchase'`, which is the contract the webhook
 * credits `userProfiles/{uid}.aiPoints` against ($1 = 100 points). Nothing
 * here changes that contract.
 */
export function BuyPointsDialog() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoadingPayment, setIsLoadingPayment] = React.useState<string | null>(null);

  const pointPackages = [
    { points: 500, price: 5, description: 'Get started' },
    { points: 1200, price: 10, description: 'Best value' },
    { points: 3000, price: 25, description: 'Power user' },
  ];

  const handlePayment = async (gateway: 'paystack' | 'paypal', points: number, price: number) => {
    if (!user?.email) {
      toast({
        variant: 'destructive',
        title: 'Cannot initiate payment',
        description: 'User email is missing.',
      });
      return;
    }
    setIsLoadingPayment(gateway);

    try {
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionType: 'points-purchase',
          amount: price,
          email: user.email,
          gateway: gateway,
          metadata: {
            userId: user.uid,
            points: points,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to create payment intent.');
      }

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL received.');
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Payment Error',
        description:
          (err instanceof Error && err.message) || 'Could not initiate payment. Please try again.',
      });
      setIsLoadingPayment(null);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Buy AI Points</DialogTitle>
        <DialogDescription>
          Points are used to power your AI tools and Live Shows. Choose a package to top up your
          balance.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {pointPackages.map((pkg) => (
          <Card key={pkg.points}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">{pkg.points.toLocaleString()} Points</p>
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">${pkg.price}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => handlePayment('paystack', pkg.points, pkg.price)}
                    disabled={!!isLoadingPayment}
                  >
                    {isLoadingPayment === 'paystack' ? <Loader2 className="animate-spin" /> : 'Paystack'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePayment('paypal', pkg.points, pkg.price)}
                    disabled={!!isLoadingPayment}
                  >
                    {isLoadingPayment === 'paypal' ? <Loader2 className="animate-spin" /> : 'PayPal'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DialogContent>
  );
}

/** Complete control: trigger + dialog. Drop into any seller surface. */
export function BuyPointsButton({
  label = 'Top up points',
  className,
  variant = 'default',
}: {
  label?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <BuyPointsDialog />
    </Dialog>
  );
}
