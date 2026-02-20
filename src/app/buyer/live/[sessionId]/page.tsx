'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RedirectSessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params.sessionId as string;

    useEffect(() => {
        if (sessionId) {
            // Unify dynamic paths to resolve Next.js slug conflict
            router.replace(`/buyer/live/${sessionId}`);
        }
    }, [sessionId, router]);

    return (
        <div className="flex h-screen w-full items-center justify-center bg-black">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}
