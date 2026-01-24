'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rocket, Store, Users, DollarSign } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-900 to-indigo-900 text-white">
      <div className="container mx-auto max-w-4xl px-4 text-center">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight md:text-6xl">
          Your Journey to Wealth Starts Here.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-neutral-300">
          Go Earn is the platform that turns your social influence into real earnings. Whether you're a seller with products or a reseller with a network, we provide the tools to build your own online business.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <Button
            size="lg"
            className="font-bold bg-primary hover:bg-primary/90 text-lg py-6 px-8 rounded-xl"
            onClick={() => router.push('/signup?role=seller')}>
            <Store className="mr-2 h-5 w-5" />
            Start Selling Today
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="font-bold text-lg py-6 px-8 rounded-xl"
            onClick={() => router.push('/signup?role=reseller')}>
            <Users className="mr-2 h-5 w-5" />
            Become a Reseller
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20"><Rocket className="h-6 w-6 text-primary"/></div>
                <div>
                    <h3 className="font-semibold">Launch Your Business</h3>
                    <p className="text-sm text-neutral-400">List unlimited products with zero upfront fees. Go live, build your brand, and sell directly to customers.</p>
                </div>
            </div>
            <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20"><Users className="h-6 w-6 text-primary"/></div>
                <div>
                    <h3 className="font-semibold">Leverage Your Network</h3>
                    <p className="text-sm text-neutral-400">Become a reseller. Share products you love and earn a commission on every sale you generate.</p>
                </div>
            </div>
            <div className="flex items-start gap-4">
                 <div className="p-3 bg-primary/10 rounded-lg border border-primary/20"><DollarSign className="h-6 w-6 text-primary"/></div>
                <div>
                    <h3 className="font-semibold">Get Paid Fast</h3>
                    <p className="text-sm text-neutral-400">Secure and reliable payouts to your preferred method. Your hustle, your money.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
