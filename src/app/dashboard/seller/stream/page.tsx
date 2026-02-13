'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SellerStudioRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to the new unified location
        router.replace('/dashboard/products?tab=studio');
    }, [router]);

    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-lg font-medium">Redirecting to the new Video Studio...</p>
            </div>
        </div>
    );
}
