'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-6">🎬 Free Live Streaming</h1>
        <p className="text-lg mb-10">No costs. No storage. Just live.</p>
        <div className="flex justify-center gap-6">
          <Button 
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-10 text-lg"
            onClick={() => router.push('/dashboard/seller/stream')}>
            🎬 I'm Selling
          </Button>
          <Button 
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-6 px-10 text-lg"
            onClick={() => router.push('/buyer/live-stream')}>
            👁️ I'm Buying
          </Button>
        </div>
      </div>
    </div>
  );
}
