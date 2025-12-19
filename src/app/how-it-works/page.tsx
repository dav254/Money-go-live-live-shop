
import { LandingLayout } from '@/components/layout/landing-layout';

export default function HowItWorksPage() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-4xl py-24 text-center">
        <h1 className="text-4xl font-bold">How It Works</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Explain the step-by-step process of using Go Earn here.
        </p>
      </div>
    </LandingLayout>
  );
}
