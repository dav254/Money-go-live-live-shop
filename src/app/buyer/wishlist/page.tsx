
'use client';

import { BuyerLayout } from '@/components/layout/buyer-layout';
import { Heart } from 'lucide-react';

export default function BuyerWishlistPage() {
    return (
        <BuyerLayout>
            <div className="container mx-auto max-w-7xl py-8">
                <h1 className="font-headline text-3xl font-bold mb-8">My Wishlist</h1>
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                    <Heart className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-semibold">Wishlist is Temporarily Disabled</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        This feature is currently undergoing maintenance and will be back soon.
                    </p>
                </div>
            </div>
        </BuyerLayout>
    );
}

    