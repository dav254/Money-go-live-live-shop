
import { LandingLayout } from '@/components/layout/landing-layout';

export default function PricingPage() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-4xl py-24 text-center">
        <h1 className="text-4xl font-bold">Pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Detail your pricing plans and what's included in each.
        </p>
      </div>
    </LandingLayout>
  );
}
