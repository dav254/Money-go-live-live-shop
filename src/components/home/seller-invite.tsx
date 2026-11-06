import Link from 'next/link';
import { ArrowRight, Store, Image, Video, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SellerInvite() {
  return (
    <section className="bg-[#090909]">
      <div className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[32px] border border-[#ff5a36]/20 bg-gradient-to-br from-[#111111] to-[#0b0b0b] p-8 text-center sm:p-12 lg:p-16">
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
              <Store className="h-3.5 w-3.5" />
              For sellers
            </div>
            <h2 className="mt-6 font-grotesk text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
              Your business deserves to be discovered.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[#d9d1c6]">
              Create your Vidnov shop, showcase your products and services, and
              connect with customers through video and live selling.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-medium text-white/70">
              {[
                'Create a business shop',
                'Publish products and services',
                'Share business videos',
                'Receive genuine customer inquiries',
                'Discover buyer requests',
                'Explore live selling',
              ].map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2"
                >
                  <Store className="h-3.5 w-3.5 text-[#ff5a36]" />
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-[#ff5a36] px-8 text-sm font-bold text-[#150d0b] shadow-[0_12px_30px_rgba(255,90,54,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#ff6b49]"
              >
                <Link href="/app/seller/create">
                  Create your free seller shop
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border border-white/15 bg-transparent px-8 text-sm font-bold text-white hover:bg-white hover:text-[#111111]"
              >
                <Link href="/how-it-works">Learn how Vidnov works</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
