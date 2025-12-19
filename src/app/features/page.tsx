
import { LandingLayout } from '@/components/layout/landing-layout';

export default function FeaturesPage() {
  return (
    <LandingLayout>
      <div className="container mx-auto max-w-4xl py-24 text-center">
        <h1 className="text-4xl font-bold">Features</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          This is where you can describe the amazing features of Go Earn.
        </p>
      </div>
    </LandingLayout>
  );
}
