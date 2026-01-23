'use client';

import PreviewPlayer from "@/components/studio/PreviewPlayer";
import PublishButton from "@/components/studio/PublishButton";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Heart, MessageCircle, MoreVertical, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo } from "react";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import type { Product } from "@/lib/types";
import { doc } from "firebase/firestore";
import { PinnedProductPreview } from "@/components/studio/PinnedProductPreview";


export default function Preview() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const firestore = useFirestore();

  useEffect(() => {
    const productId = localStorage.getItem('selectedProductId');
    if (productId) {
      setSelectedProductId(productId);
    }
  }, []);

  const productRef = useMemoFirebase(() => {
    if (!selectedProductId) return null;
    return doc(firestore, 'products', selectedProductId);
  }, [firestore, selectedProductId]);

  const { data: product, isLoading } = useDoc<Product>(productRef);

  return (
    <SellerLayout>
        <div className="bg-black text-white h-screen">
        <div className="relative h-full">
            <PreviewPlayer />

            <div className="absolute bottom-24 left-4 z-10">
              <PinnedProductPreview product={product} isLoading={isLoading} />
            </div>

            <div className="absolute bottom-20 right-4 z-10">
            <div className="flex flex-col items-center gap-4">
                 <Button size="icon" variant="ghost" className="bg-black/50 hover:bg-black/70 rounded-full h-12 w-12 flex-col gap-1">
                    <Heart className="h-6 w-6"/>
                    <span className="text-xs font-bold">10k</span>
                </Button>
                <Button size="icon" variant="ghost" className="bg-black/50 hover:bg-black/70 rounded-full h-12 w-12 flex-col gap-1">
                    <MessageCircle className="h-6 w-6"/>
                    <span className="text-xs font-bold">200</span>
                </Button>
                <Button size="icon" variant="ghost" className="bg-black/50 hover:bg-black/70 rounded-full h-12 w-12 flex-col gap-1">
                    <Share2 className="h-6 w-6"/>
                    <span className="text-xs font-bold">Share</span>
                </Button>
                <Button size="icon" variant="ghost" className="bg-black/50 hover:bg-black/70 rounded-full h-12 w-12">
                    <MoreVertical className="h-6 w-6"/>
                </Button>
            </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 z-10">
            <PublishButton />
            </div>
        </div>
        </div>
    </SellerLayout>
  );
}
