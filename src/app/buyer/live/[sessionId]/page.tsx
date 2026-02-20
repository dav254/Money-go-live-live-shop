'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * REDIRECTOR: This file resolves the Next.js slug conflict.
 * It redirects [sessionId] links to the unified [sellerId] path.
 */
export default function RedirectSessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.sessionId as string;

    useEffect(() => {
        if (sessionId) {
            // Unify dynamic paths to resolve Next.js naming conflict
            router.replace(`/buyer/live/${sessionId}`);
        }
    }, [sessionId, router]);

    return (
        <div className="flex h-screen w-full items-center justify-center bg-black">
            <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-xs font-black uppercase tracking-widest text-white/50">Syncing Stream Bridge...</p>
            </div>
        </div>
    );
}
