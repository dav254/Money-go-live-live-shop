
import PreviewPlayer from "@/components/studio/PreviewPlayer";
import PublishButton from "@/components/studio/PublishButton";
import { SellerLayout } from "@/components/layout/seller-layout";
import { Heart, MessageCircle, MoreVertical, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Preview() {
  return (
    <SellerLayout>
        <div className="bg-black text-white h-screen">
        <div className="relative h-full">
            <PreviewPlayer />
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
