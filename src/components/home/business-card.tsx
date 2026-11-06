import Link from 'next/link';
import { MapPin, Store, Users } from 'lucide-react';
import { FeaturedBadge } from './featured-badge';
import { BadgeCheck } from 'lucide-react';

export interface LandingBusiness {
  id: string;
  image: string;
  name: string;
  category: string;
  location: string;
  description: string;
  verified: boolean;
}

export function BusinessCard({ business }: { business: LandingBusiness }) {
  return (
    <Link
      href={`/sellers/${business.id}`}
      className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-3 transition-all hover:-translate-y-1 hover:border-[#ff5a36]/30 hover:shadow-[0_20px_60px_rgba(255,82,54,0.12)]"
    >
      <div className="relative h-36 overflow-hidden rounded-xl bg-[#111111]">
        <img
          src={business.image}
          alt={business.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909]/80 via-transparent to-transparent" />

        {business.verified && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#ff5a36] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#1c0907]">
            <BadgeCheck className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-grotesk text-base font-bold text-white">
            {business.name}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#ff5a36]">
            {business.category}
          </p>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-white/60">
        {business.description}
      </p>

      <div className="mt-3 flex items-center gap-3 text-[10px] font-medium text-white/50">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-[#ff5a36]" />
          {business.location}
        </span>
        <span className="flex items-center gap-1">
          <Store className="h-3 w-3 text-[#ff5a36]" />
          {business.category === 'Food & Drink' ? '12' : '6'}
        </span>
      </div>
    </Link>
  );
}
