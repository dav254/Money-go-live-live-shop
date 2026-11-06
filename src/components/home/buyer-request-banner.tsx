import Link from 'next/link';
import { ArrowRight, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BuyerRequestBanner() {
  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#111111] to-[#0b0b0b] p-8 text-center sm:p-12 lg:p-16">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1400&q=80')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-hidden
          />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff5a36]/30 bg-[#ff5a36]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-[#ffcbba]">
              <Send className="h-3.5 w-3.5" />
              Buyer request
            </div>
            <h2 className="mt-6 font-grotesk text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
              Can&apos;t find what you need?
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-base leading-relaxed text-[#d9d1c6]">
              Tell businesses what you&apos;re looking for and let relevant
              sellers send you offers — with a photo, a budget and your
              preferred location.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 rounded-full bg-[#ff5a36] px-8 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] hover:-translate-y-0.5 hover:bg-[#ff6b49]"
            >
              <Link href="/buyer/requests/new">
                Post a Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-4 text-xs text-white/50">
              You will be redirected through the existing login flow if you are
              not already signed in.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
