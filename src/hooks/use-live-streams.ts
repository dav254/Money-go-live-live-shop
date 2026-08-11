
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase'; 
import type { LiveSession } from '@/lib/types';

export const useLiveStreams = () => {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    if (!firestore) return;

    const q = query(collection(firestore, 'liveSessions'), where('status', '==', 'live'));

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const sessions: LiveSession[] = [];
        snapshot.forEach(doc => {
          sessions.push({ id: doc.id, ...doc.data() } as LiveSession);
        });
        setLiveSessions(sessions);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching live streams:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore]);

  return { liveSessions, isLoading, error };
};
