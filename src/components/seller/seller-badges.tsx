'use client';

import type { Seller } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Star, Zap, Award, Rocket } from 'lucide-react';

interface SellerBadgesProps {
  seller: Seller;
}

// These thresholds would ideally come from a config or be more dynamic
const POPULAR_SHOP_FOLLOWERS = 10000;
const NEW_SELLER_DAYS = 30;

export function SellerBadges({ seller }: SellerBadgesProps) {
  const isPopular = seller.followers >= POPULAR_SHOP_FOLLOWERS;
  const joinedDate = seller.joinedDate ? new Date(seller.joinedDate) : new Date();
  const isNew = (new Date().getTime() - joinedDate.getTime()) / (1000 * 3600 * 24) < NEW_SELLER_DAYS;

  const badges = [
    { show: seller.isVerified, label: 'Verified', icon: ShieldCheck, color: 'bg-blue-500' },
    { show: isPopular, label: 'Popular', icon: Star, color: 'bg-purple-500' },
    { show: isNew, label: 'New Seller', icon: Rocket, color: 'bg-green-500' },
    { show: seller.deliversFast, label: 'Fast Delivery', icon: Zap, color: 'bg-teal-500' },
  ].filter(badge => badge.show);

  if (badges.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
      {badges.map(({ label, icon: Icon, color }) => (
        <Badge key={label} className={`flex items-center gap-1.5 border-transparent text-white ${color}`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="font-semibold">{label}</span>
        </Badge>
      ))}
    </div>
  );
}
