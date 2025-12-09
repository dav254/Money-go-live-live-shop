
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { LiveSellerCard } from '@/components/buyer/LiveSellerCard';

// Mock data for live sellers
const liveSellers = [
  { id: "shop123", name: "David Shoe Store", viewers: 120, avatar: 'https://picsum.photos/seed/shop123/80' },
  { id: "shop456", name: "Nairobi Fashion", viewers: 89, avatar: 'https://picsum.photos/seed/shop456/80' },
  { id: "shop789", name: "Tech Gadgets Kenya", viewers: 250, avatar: 'https://picsum.photos/seed/shop789/80' }
];

export default function LiveSellersPage() {
  return (
    <BuyerLayout>
        <div className="p-4 space-y-4">
            <h1 className="text-2xl font-bold font-headline">🔴 Live Sellers</h1>
            <div className="grid gap-4">
            {liveSellers.map((seller) => (
                <LiveSellerCard key={seller.id} seller={seller} />
            ))}
            </div>
        </div>
    </BuyerLayout>
  );
}
