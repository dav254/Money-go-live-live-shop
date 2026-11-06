'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (!q) return;
    const params = new URLSearchParams('');
    params.set('q', q);
    router.push(`/search?${params.toString()}`);
  };

  if (!isClient) return null;

  return (
    <form
      onSubmit={submit}
      role="search"
      className={className}
      aria-label="Global search"
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
        <Search className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search products, services and businesses..."
          aria-label="Search Vidnov"
          className="w-full min-w-0 bg-transparent text-xs text-white/90 placeholder:text-white/40 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Search Vidnov"
          className="rounded-full bg-[#ff5a36] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#150d0b] transition hover:bg-[#ff6b49]"
        >
          Search
        </button>
      </div>
    </form>
  );
}
