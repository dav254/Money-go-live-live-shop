'use client';

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { LiveSession, UserProfile } from "@/lib/types";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { Skeleton } from "../ui/skeleton";
import { Users } from "lucide-react";

interface LiveSellerCardProps {
    sellerSession: LiveSession;
}

export function LiveSellerCard({ sellerSession }: LiveSellerCardProps) {
  const firestore = useFirestore();
  
  const sellerProfileRef = useMemoFirebase(() => {
    if(!sellerSession.sellerId) return null;
    return doc(firestore, 'userProfiles', sellerSession.sellerId);
  }, [firestore, sellerSession.sellerId]);
  
  const { data: seller, isLoading } = useDoc<UserProfile>(sellerProfileRef);

  if (isLoading) {
      return <Skeleton className="h-24 w-full" />;
  }
  
  if (!seller) {
      return null; // Or some fallback UI for a session with a missing seller
  }

  return (
    <Link href={`/buyer/live/${sellerSession.id}`} className="block">
      <div className="bg-neutral-900 border border-neutral-800 hover:border-primary/50 text-white p-4 rounded-lg flex justify-between items-center transition-all">
        <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12 border-2 border-red-500">
                <AvatarImage src={seller.profilePictureUrl} />
                <AvatarFallback>{seller.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <h2 className="font-bold">{seller.shopName || seller.fullName}</h2>
                <p className="text-red-500 text-sm font-semibold">🔴 LIVE</p>
            </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Users className="h-4 w-4"/>
            <span>{sellerSession.viewerCount || 0}</span>
        </div>
      </div>
    </Link>
  );
}
