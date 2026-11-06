import Link from 'next/link';
import { Play, Star, Store } from 'lucide-react';

export interface LandingVideo {
  id: string;
  image: string;
  title: string;
  seller: string;
}

export function VideoCard({ video }: { video: LandingVideo }) {
  return (
    <Link
      href={`/videos/${video.id}`}
      className="group overflow-hidden rounded-[20px] border border-white/10 bg-white/5 transition-all hover:-translate-y-1 hover:border-[#ff5a36]/30 hover:shadow-[0_20px_60px_rgba(255,82,54,0.12)]"
    >
      <div className="relative h-36 overflow-hidden bg-[#111111]">
        <img
          src={video.image}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090909]/80 via-transparent to-transparent" />

        <div className="absolute inset-0 flex items-center justify-center">
          <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff5a36] text-[#1c0907] shadow-lg transition-transform hover:scale-110">
            <Play className="h-5 w-5 fill-current" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <p className="truncate font-grotesk text-sm font-bold text-white">
            {video.title}
          </p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          <span className="flex items-center gap-1">
            <Store className="h-3 w-3 text-[#ff5a36]" />
            {video.seller}
          </span>
        </div>
      </div>
    </Link>
  );
}
