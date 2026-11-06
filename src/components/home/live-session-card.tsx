import Link from 'next/link';
import { CirclePlay, Users } from 'lucide-react';

export interface LandingLiveSession {
  id: string;
  seller: string;
  title: string;
  thumbnail: string;
}

export function LiveSessionCard({ session }: { session: LandingLiveSession }) {
  return (
    <Link
      href={`/buyer/live/${session.id}`}
      className="group relative h-[200px] w-[240px] shrink-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#171717] transition-all hover:-translate-y-1 hover:border-[#ff5a36]/50"
    >
      <img
        src={session.thumbnail}
        alt={session.title}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#090909]/90 via-transparent to-transparent" />

      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#ff5a36] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#1c0907]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#1c0907]" />
        Live
      </div>

      <div className="absolute bottom-3 left-3 right-3">
        <p className="truncate font-grotesk text-sm font-bold text-white">
          {session.title}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#ffcfbf]">
          <Users className="h-3 w-3" />
          {session.seller}
        </p>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-[#111111]/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#ffcfbf]">
        <CirclePlay className="h-3 w-3 fill-current" />
        Watch
      </div>
    </Link>
  );
}
