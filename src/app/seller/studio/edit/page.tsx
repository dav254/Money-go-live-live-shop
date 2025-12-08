import VideoEditor from "@/components/studio/VideoEditor";
import { SellerLayout } from "@/components/layout/seller-layout";

export default function Edit() {
  return (
    <SellerLayout>
        <div className="bg-black text-white h-screen">
            <h1 className="p-4 font-bold">Edit Video</h1>
            <VideoEditor />
        </div>
    </SellerLayout>
  );
}
