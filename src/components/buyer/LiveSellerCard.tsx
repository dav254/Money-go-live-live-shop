
'use client';

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function LiveSellerCard({ seller }) {
  return (
    <Link href={`/buyer/live/${seller.id}`} className="block">
      <div className="bg-neutral-900 border border-neutral-800 hover:border-primary/50 text-white p-4 rounded-lg flex justify-between items-center transition-all">
        <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-red-500">
                <AvatarImage src={seller.avatar} />
                <AvatarFallback>{seller.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <h2 className="font-bold">{seller.name}</h2>
                <p className="text-red-500 text-sm font-semibold">🔴 LIVE</p>
            </div>
        </div>
        <span className="text-sm text-neutral-400">{seller.viewers} watching</span>
      </div>
    </Link>
  );
}
