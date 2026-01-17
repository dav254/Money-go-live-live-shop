
'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { LiveSession } from '@/lib/types';
import { BuyerLayout } from '@/components/layout/buyer-layout';
import { cn } from '@/lib/utils';
import { BuyerVideoCard } from '@/components/buyer/BuyerVideoCard';
import { Video } from 'lucide-react';

export default function LiveStreamPage() {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const firestore = useFirestore();
    const [intersectingIndex, setIntersectingIndex] = useState(0);

    const liveSessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));
    }, [firestore]);

    const { data: liveSessions, isLoading } = useCollection<LiveSession>(liveSessionsQuery);
    
    const handleScroll = useCallback((direction: 'up' | 'down') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollAmount = container.clientHeight;
        const currentScroll = container.scrollTop;

        let targetScroll;
        if (direction === 'down') {
            targetScroll = currentScroll + scrollAmount;
        } else {
            targetScroll = currentScroll - scrollAmount;
        }
        
        container.scrollTo({
            top: targetScroll,
            behavior: 'smooth',
        });
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
                        setIntersectingIndex(index);
                    }
                });
            },
            { threshold: 0.5 }
        );

        const cards = scrollContainerRef.current?.querySelectorAll('[data-video-card]');
        cards?.forEach(card => observer.observe(card));

        return () => cards?.forEach(card => observer.unobserve(card));
    }, [liveSessions]);

    if (isLoading) {
        return (
            <BuyerLayout>
                <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center">
                    <p>Finding live streams...</p>
                </div>
            </BuyerLayout>
        );
    }
    
    return (
        <BuyerLayout fullWidth>
            <div className="relative h-[calc(100vh-4rem)] w-full">
                <div 
                    ref={scrollContainerRef}
                    className={cn(
                        "h-full w-full snap-y snap-mandatory overflow-y-scroll",
                        "[&::-webkit-scrollbar]:hidden",
                        "scrollbar-hide"
                    )}
                >
                {liveSessions && liveSessions.length > 0 ? (
                    liveSessions.map((session, index) => (
                        <div key={session.id} className="h-full w-full snap-start flex-shrink-0" data-video-card data-index={index}>
                            <BuyerVideoCard 
                                liveSession={session}
                                onScroll={handleScroll}
                                isIntersecting={index === intersectingIndex}
                            />
                        </div>
                    ))
                ) : (
                    <div className="h-full w-full snap-start flex-shrink-0 flex items-center justify-center bg-muted">
                        <div className="text-center p-4">
                             <Video className="mx-auto h-12 w-12 text-muted-foreground" />
                            <h2 className="mt-4 text-xl font-semibold">No Sellers Are Live</h2>
                            <p className="text-muted-foreground">Please check back later to see live shopping videos.</p>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </BuyerLayout>
    );
}
